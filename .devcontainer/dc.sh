#!/usr/bin/env bash
# Start, stop and enter the dev container with plain Docker (no VS Code, no Node on the host).
# The image is rebuilt and the container recreated whenever the image inputs or this script change.
# Keep the run options in sync with devcontainer.json.
set -euo pipefail

DC_DIR=$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)
ROOT=$(dirname "$DC_DIR")

sha256() {
    if command -v sha256sum >/dev/null; then sha256sum; else shasum -a 256; fi
}

# One container (and set of volumes) per checkout folder, so copies of this repo do not share one
SLUG=$(basename "$ROOT" | tr -c 'A-Za-z0-9_.-' '-' | sed 's/^-*//; s/-*$//')
NAME=alp-${SLUG:-workspace}-$(printf '%s' "$ROOT" | sha256 | cut -c1-8)
IMAGE=alp-devcontainer
# Metro / Expo web listens on 8081 in the container; override the host side if 8081 is taken
HOST_PORT=${ALP_HOST_PORT:-8081}

usage() {
    cat <<EOF
Usage: [ALP_HOST_PORT=8081] $(basename "$0") <command> [args]

  start            Build/recreate if needed, start the container, apply the firewall
  shell            start, then open zsh in the container
  claude [args]    start, then run Claude Code in full auto mode
  exec <cmd...>    start, then run a command in /workspace
  stop             Stop the container (state and volumes are kept)
  down             Remove the container (volumes are kept)
  rebuild          Rebuild the image without cache (updates Claude Code, Playwright, ...)
  status           Show container, image and firewall state
EOF
}

config_hash() {
    { (cd "$DC_DIR" && cat Dockerfile init-firewall.sh allowed-domains.txt dc.sh); echo "$HOST_PORT"; } | sha256 | cut -c1-12
}

HASH=$(config_hash)

container_state() {
    local state
    state=$(docker inspect -f '{{.State.Status}}' "$NAME" 2>/dev/null) || state=missing
    echo "$state"
}

container_hash() {
    docker inspect -f '{{index .Config.Labels "alp.hash"}}' "$NAME" 2>/dev/null || true
}

build_image() {
    echo "Building image $IMAGE:$HASH..."
    docker build "$@" -t "$IMAGE:$HASH" "$DC_DIR"
    for tag in $(docker images "$IMAGE" --format '{{.Tag}}'); do
        [ "$tag" = "$HASH" ] || docker rmi "$IMAGE:$tag" >/dev/null 2>&1 || true
    done
}

create_container() {
    echo "Creating container $NAME..."
    if ! docker run -d --init --name "$NAME" --hostname alp \
        --label "alp.hash=$HASH" \
        --cap-add=NET_ADMIN --cap-add=NET_RAW \
        -e NODE_OPTIONS=--max-old-space-size=4096 \
        -e CLAUDE_CONFIG_DIR=/home/node/.claude \
        -e POWERLEVEL9K_DISABLE_GITSTATUS=true \
        -v "$ROOT:/workspace" \
        -v "$DC_DIR:/workspace/.devcontainer:ro" \
        -v "$NAME-node-modules:/workspace/node_modules" \
        -v "$NAME-claude-config:/home/node/.claude" \
        -v "$NAME-bashhistory:/commandhistory" \
        -p "127.0.0.1:$HOST_PORT:8081" \
        -u node -w /workspace \
        "$IMAGE:$HASH" sleep infinity >/dev/null; then
        docker rm -f "$NAME" >/dev/null 2>&1 || true
        echo "Could not start the container. If port $HOST_PORT is taken, set ALP_HOST_PORT." >&2
        exit 1
    fi
}

firewall_active() {
    docker exec -u root "$NAME" iptables -S OUTPUT 2>/dev/null | grep -q -- '-P OUTPUT DROP'
}

apply_firewall() {
    echo "Applying firewall..."
    if ! docker exec -u node "$NAME" sudo /usr/local/bin/init-firewall.sh; then
        echo "Firewall setup failed, stopping the container." >&2
        docker stop "$NAME" >/dev/null
        exit 1
    fi
}

configure_git() {
    local name email
    name=$(git -C "$ROOT" config user.name || true)
    email=$(git -C "$ROOT" config user.email || true)
    [ -n "$name" ] && docker exec -u node "$NAME" git config --global user.name "$name"
    [ -n "$email" ] && docker exec -u node "$NAME" git config --global user.email "$email"
    return 0
}

start() {
    local created=false
    docker image inspect "$IMAGE:$HASH" >/dev/null 2>&1 || build_image

    if [ "$(container_state)" != "missing" ] && [ "$(container_hash)" != "$HASH" ]; then
        echo "Configuration changed, recreating the container..."
        docker rm -f "$NAME" >/dev/null
    fi

    case "$(container_state)" in
        missing) create_container; created=true ;;
        running) ;;
        *) docker start "$NAME" >/dev/null ;;
    esac

    firewall_active || apply_firewall
    configure_git

    if $created && [ -f "$ROOT/package-lock.json" ]; then
        docker exec -u node -w /workspace "$NAME" npm ci
    fi
}

run_in() {
    local tty=-i
    [ -t 0 ] && [ -t 1 ] && tty=-it
    docker exec $tty -u node -w /workspace "$NAME" "$@"
}

status() {
    local state
    state=$(container_state)
    echo "Container: $NAME ($state)"
    echo "Workspace: $ROOT"
    if [ "$state" != "missing" ]; then
        if [ "$(container_hash)" = "$HASH" ]; then echo "Config:    current ($HASH)"; else echo "Config:    outdated, next start recreates it"; fi
    fi
    [ "$state" = "running" ] && echo "Metro:     http://localhost:$HOST_PORT"
    if [ "$state" = "running" ]; then
        if firewall_active; then echo "Firewall:  active"; else echo "Firewall:  NOT active"; fi
    fi
}

cmd=${1:-}
[ $# -gt 0 ] && shift
case "$cmd" in
    start) start; status ;;
    shell) start; run_in zsh ;;
    claude) start; run_in claude --dangerously-skip-permissions "$@" ;;
    exec) [ $# -gt 0 ] || { usage; exit 1; }; start; run_in "$@" ;;
    stop) docker stop "$NAME" >/dev/null 2>&1 && echo "Stopped." || echo "Not running." ;;
    down) docker rm -f "$NAME" >/dev/null 2>&1 && echo "Removed." || echo "No container." ;;
    rebuild)
        docker rm -f "$NAME" >/dev/null 2>&1 || true
        build_image --no-cache --pull
        start; status ;;
    status) status ;;
    -h|--help|help|"") usage ;;
    *) usage; exit 1 ;;
esac
