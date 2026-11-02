# Dev container

Sandboxed environment for working on this project with Claude Code in full auto mode
(`claude --dangerously-skip-permissions`, alias `claude-auto`).

## Contents

- Node LTS (`NODE_VERSION` build arg) with npm workspaces, Expo CLI via `npx expo`, `eas-cli`
- Playwright with Chromium, Firefox and WebKit for the web E2E tests (§7.1)
- `rsvg-convert` and ImageMagick for icon PNGs from `assets/icon/icon.svg` (§4.11), `sqlite3`
- Claude Code, `gh`, git-delta, ripgrep, fd, jq, fzf, zsh
- Named volumes for `node_modules` (fast installs on macOS), `~/.claude` and shell history

Not included: Android SDK, Xcode and Maestro. Native builds run on EAS Build. Native E2E
and device tests (§7.1, §7.3) run on the host.

## Firewall

`init-firewall.sh` runs on every container start and blocks all outbound traffic except:

- the domains in `allowed-domains.txt` (npm, Anthropic, Expo/EAS, Playwright CDN, VS Code)
- DNS and the Docker host network

IPv6 egress is blocked. GitHub is blocked on purpose: Claude may commit inside the container, but
it cannot push (or fetch). Push, pull and `gh` run on the host. This works regardless of which git
credentials VS Code forwards into the container. The script and the allowlist are copied into the image and owned by root.
The `node` user can run only the script via sudo, so code in the container cannot widen the allowlist.
To allow another domain, add it to `allowed-domains.txt` and rebuild the container.

The domains are resolved once at startup. If a CDN changes its IPs, rerun
`sudo /usr/local/bin/init-firewall.sh` or restart the container.

## Usage

Without VS Code, use `.devcontainer/dc.sh` (needs only Docker and git on the host):

```sh
.devcontainer/dc.sh claude      # start and run Claude Code in full auto mode
.devcontainer/dc.sh shell       # start and open zsh
.devcontainer/dc.sh exec npm test
.devcontainer/dc.sh status
.devcontainer/dc.sh stop        # keeps the container; down removes it
.devcontainer/dc.sh rebuild     # no-cache rebuild, picks up new tool versions
```

`start` (and every command that starts the container) builds the image and recreates the
container when `Dockerfile`, `init-firewall.sh`, `allowed-domains.txt`, `dc.sh` or the host port
changed. It applies the firewall whenever it is not active and stops the container if that fails.
It copies your host git name and email into the container. `node_modules`, the Claude login and
shell history live in named volumes and survive recreation.

Metro / Expo web (`npx expo start --web`) listens on 8081 in the container and is published on
`localhost:8081`. If that port is taken, set `ALP_HOST_PORT`, e.g. `ALP_HOST_PORT=18081 .devcontainer/dc.sh start`.

With VS Code: "Dev Containers: Reopen in Container", then run `claude-auto` in the terminal.
`devcontainer.json` and `dc.sh` describe the same container; keep their run options in sync.

`.devcontainer/` is mounted read-only inside the container, so the container setup, the
firewall and `dc.sh` (which runs on the host) can only be changed from the host. Edit these files on the host and rebuild. Changes can
still arrive through git (a commit made in the container, or a pull), so review changes to
`.devcontainer/` before you rebuild.

Full auto mode can still read anything in the workspace and send it to the allowed hosts. Use it only with repositories you trust.
