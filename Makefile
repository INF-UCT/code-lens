cli:
	cd apps/cli && cargo run

run:
	docker compose up

detach:
	docker compose up -d

clean:
	docker compose down -v

lint:
	cargo clippy --workspace --all-targets --all-features -- -D warnings

fmt:
	cargo fmt --all