FROM rust:1.92-slim-bookworm AS dev

RUN apt-get update && apt-get install -y \
    unzip \
    build-essential \
    pkg-config \
    wireguard \
    iproute2 \
    wireguard-tools \
    netcat-traditional \
    iputils-ping \
    wget \
    curl \
    && rm -rf /var/lib/apt/lists/*

RUN wget https://github.com/watchexec/cargo-watch/releases/download/v8.5.3/cargo-watch-v8.5.3-x86_64-unknown-linux-gnu.tar.xz && \
    tar -xf cargo-watch-v8.5.3-x86_64-unknown-linux-gnu.tar.xz && \
    mv cargo-watch-v8.5.3-x86_64-unknown-linux-gnu/cargo-watch /usr/local/bin/ && \
    rm -rf cargo-watch-v8.5.3-x86_64-unknown-linux-gnu.tar.xz cargo-watch-v8.5.3-x86_64-unknown-linux-gnu

WORKDIR /app

COPY Cargo.toml Cargo.lock ./
COPY apps/server ./apps/server
COPY .config ./.config

ENV CARGO_TARGET_DIR /app/target

RUN chmod +x /app/apps/server/config/vpn.sh && \
    chmod +x /app/apps/server/config/entrypoint.sh

EXPOSE 8000

CMD ["/bin/bash", "/app/apps/server/config/entrypoint.sh"]
