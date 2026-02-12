# ==============================================================================
# Development Stage
# ==============================================================================

FROM rust:1.92-alpine AS dev

RUN apk add --no-cache \
	wireguard-tools \
	iproute2 \
	openssl-dev \
	openssl-libs-static \
	netcat-openbsd \
	iputils \
	unzip \
	build-base \
	pkgconf \
	bash \
	ripgrep \
	tree \
	&& rm -rf /var/cache/apk/*

RUN wget https://github.com/watchexec/cargo-watch/releases/download/v8.5.3/cargo-watch-v8.5.3-x86_64-unknown-linux-musl.tar.xz && \
	tar -xf cargo-watch-v8.5.3-x86_64-unknown-linux-musl.tar.xz && \
	mv cargo-watch-v8.5.3-x86_64-unknown-linux-musl/cargo-watch /usr/local/bin/ && \
	rm -rf cargo-watch-v8.5.3-x86_64-unknown-linux-musl.tar.xz cargo-watch-v8.5.3-x86_64-unknown-linux-musl

WORKDIR /app
ENV CARGO_TARGET_DIR /app/target

CMD ["/bin/bash", "/app/apps/server/config/entrypoint.sh"]

# ==============================================================================
# Build Stage
# ==============================================================================

FROM rust:1.92-alpine AS builder

RUN apk add --no-cache \
	build-base \
	pkgconf \
	openssl-dev \
	openssl-libs-static \
	&& rm -rf /var/cache/apk/*

WORKDIR /app
COPY . .

ENV CARGO_TARGET_DIR /app/target
RUN cargo build -p server --bin server --release

# ==============================================================================
# Production Stage
# ==============================================================================

FROM alpine:latest AS production

RUN apk add --no-cache ca-certificates openssl ripgrep tree && rm -rf /var/cache/apk/*

WORKDIR /app

RUN adduser -D appuser
USER appuser

COPY --from=builder /app/target/release/server ./server
COPY --from=builder /app/apps/server/config/migrations ./config/migrations
COPY --from=builder /app/apps/server/config/config.toml ./config/config.toml
COPY --from=builder /app/apps/server/config/ignore-patterns ./config/ignore-patterns

CMD ["./server"]
