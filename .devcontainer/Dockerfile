ARG NODE_VERSION=24
FROM node:${NODE_VERSION}-bookworm

ARG TZ=Europe/Berlin
ENV TZ="$TZ"

ARG CLAUDE_CODE_VERSION=latest
ARG EAS_CLI_VERSION=latest
ARG PLAYWRIGHT_VERSION=latest
ARG GIT_DELTA_VERSION=0.18.2

# System tools, firewall tooling, icon rendering (§4.11) and SQLite CLI (§4.5)
RUN apt-get update && apt-get install -y --no-install-recommends \
    dnsutils \
    fzf \
    gnupg2 \
    iproute2 \
    ipset \
    iptables \
    jq \
    less \
    librsvg2-bin \
    imagemagick \
    man-db \
    nano \
    procps \
    ripgrep \
    fd-find \
    sqlite3 \
    sudo \
    unzip \
    vim \
    zsh \
  && ln -s /usr/bin/fdfind /usr/local/bin/fd \
  && apt-get clean && rm -rf /var/lib/apt/lists/*

# GitHub CLI
RUN mkdir -p -m 755 /etc/apt/keyrings \
  && curl -fsSL https://cli.github.com/packages/githubcli-archive-keyring.gpg -o /etc/apt/keyrings/githubcli-archive-keyring.gpg \
  && chmod go+r /etc/apt/keyrings/githubcli-archive-keyring.gpg \
  && echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/githubcli-archive-keyring.gpg] https://cli.github.com/packages stable main" \
     > /etc/apt/sources.list.d/github-cli.list \
  && apt-get update && apt-get install -y --no-install-recommends gh \
  && apt-get clean && rm -rf /var/lib/apt/lists/*

# git-delta for readable diffs
RUN ARCH=$(dpkg --print-architecture) \
  && curl -fsSL -o /tmp/git-delta.deb "https://github.com/dandavison/delta/releases/download/${GIT_DELTA_VERSION}/git-delta_${GIT_DELTA_VERSION}_${ARCH}.deb" \
  && dpkg -i /tmp/git-delta.deb && rm /tmp/git-delta.deb

# Playwright browsers for the web E2E tests (§7.1). Chromium, Firefox and WebKit
# cover the web targets in §7.4. The project's own @playwright/test version may
# need a different browser build; `npx playwright install` works at runtime
# because the Playwright CDN is on the firewall allowlist.
ENV PLAYWRIGHT_BROWSERS_PATH=/ms-playwright
RUN npx -y playwright@${PLAYWRIGHT_VERSION} install --with-deps chromium firefox webkit \
  && chown -R node:node /ms-playwright \
  && apt-get clean && rm -rf /var/lib/apt/lists/*

# Global npm packages go to a user-owned prefix
RUN mkdir -p /usr/local/share/npm-global && chown -R node:node /usr/local/share
ENV NPM_CONFIG_PREFIX=/usr/local/share/npm-global
ENV PATH=$PATH:/usr/local/share/npm-global/bin

# Persisted shell history, Claude config and node_modules (named volumes inherit
# this ownership on first mount)
RUN mkdir -p /commandhistory /home/node/.claude /workspace/node_modules \
  && touch /commandhistory/.bash_history /commandhistory/.zsh_history \
  && chown -R node:node /commandhistory /home/node/.claude /workspace

ENV DEVCONTAINER=true
ENV SHELL=/bin/zsh
ENV EDITOR=nano
ENV VISUAL=nano
# §4.10: no telemetry
ENV EXPO_NO_TELEMETRY=1
ENV DO_NOT_TRACK=1

# Firewall: root-owned script and allowlist, the node user may only run the script
COPY init-firewall.sh /usr/local/bin/init-firewall.sh
COPY allowed-domains.txt /usr/local/etc/allowed-domains.txt
RUN chmod 755 /usr/local/bin/init-firewall.sh \
  && chmod 644 /usr/local/etc/allowed-domains.txt \
  && echo "node ALL=(root) NOPASSWD: /usr/local/bin/init-firewall.sh" > /etc/sudoers.d/node-firewall \
  && chmod 0440 /etc/sudoers.d/node-firewall

USER node
WORKDIR /workspace

# zsh with history in the persisted volume
RUN sh -c "$(curl -fsSL https://github.com/deluan/zsh-in-docker/releases/download/v1.2.1/zsh-in-docker.sh)" -- \
    -p git \
    -p fzf \
    -a "source /usr/share/doc/fzf/examples/key-bindings.zsh" \
    -a "source /usr/share/doc/fzf/examples/completion.zsh" \
    -a "export HISTFILE=/commandhistory/.zsh_history" \
    -a "export PROMPT_COMMAND='history -a'" \
    -a "export PATH=\$PATH:/usr/local/share/npm-global/bin" \
    -a "alias claude-auto='claude --dangerously-skip-permissions'" \
    -x \
  && echo "export HISTFILE=/commandhistory/.bash_history" >> /home/node/.bashrc \
  && echo 'export PATH=$PATH:/usr/local/share/npm-global/bin' >> /home/node/.bashrc \
  && echo "alias claude-auto='claude --dangerously-skip-permissions'" >> /home/node/.bashrc

# The bind-mounted workspace is owned by the host user, not by node
RUN git config --global --add safe.directory /workspace \
  && git config --global core.pager delta \
  && git config --global interactive.diffFilter "delta --color-only" \
  && git config --global delta.navigate true

RUN npm install -g --allow-scripts=@anthropic-ai/claude-code \
    @anthropic-ai/claude-code@${CLAUDE_CODE_VERSION} \
    eas-cli@${EAS_CLI_VERSION}
