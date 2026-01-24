# ==============================================================================
# Development Stage
# ==============================================================================

FROM rust:1.92-bookworm AS dev

RUN apt-get update && apt-get install -y \
    wireguard \
    iproute2 \
    libssl-dev \
    wireguard-tools \
    netcat-traditional \
    iputils-ping \
    unzip \
    build-essential \
    pkg-config \
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

ENV CARGO_TARGET_DIR /app/target

RUN chmod +x /app/apps/server/config/vpn.sh && \
    chmod +x /app/apps/server/config/entrypoint.sh

CMD ["/bin/bash", "/app/apps/server/config/entrypoint.sh"]

# ==============================================================================
# Build Stage
# ==============================================================================

FROM rust:1.92-bookworm AS builder

WORKDIR /app

COPY . .

ENV CARGO_TARGET_DIR /app/target
RUN cargo build -p server --release

# ==============================================================================
# Production Stage
# ==============================================================================

FROM debian:bookworm-slim AS production

RUN apt-get update && apt-get install -y \
    ca-certificates \
    libssl3 \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

RUN useradd -m appuser
USER appuser

COPY --from=builder /app/target/release/server ./server
COPY --from=builder /app/apps/server/config/migrations ./config/migrations
COPY --from=builder /app/apps/server/config/config.toml ./config/config.toml

CMD ["RUST_LOG=error", "./server"]
