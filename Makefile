cli:
	cd apps/cli && npm start || true

run:
	docker compose up

detach:
	docker compose up -d

clean:
	docker compose down -v

fmt:
	cargo fmt --all
	cd apps/cli && npm run format

lint:
	cargo clippy --workspace --all-targets --all-features -- -D warnings
	cd apps/cli && npm run lint

migration:
	cd apps/server && sqlx migrate add --source ./config/migrations $(name)