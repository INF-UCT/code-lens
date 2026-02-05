ifneq (,$(wildcard ./.env))
    include .env
    export
endif

CLI=apps/cli
SERVER=apps/server

.DEFAULT_GOAL := run
.PHONY: cli run detach clean fmt lint migration machete nursery db-clean

cli:
	cd $(CLI) && npm start || true

run:
	docker compose up

detach:
	docker compose up -d

clean:
	docker compose down -v

clean-db:
	docker exec code-lens-postgres psql -U user -d database -c "DROP SCHEMA public CASCADE; CREATE SCHEMA public;"
	cd $(SERVER) && sqlx migrate run --source ./config/migrations --database-url $(LOCAL_POSTGRES_DATABASE_URL)

fmt:
	cargo fmt --all
	cd $(CLI) && npm run format

lint:
	cargo clippy --workspace --all-targets --all-features -- -D warnings
	cd $(CLI) && npm run lint

migration:
	cd $(SERVER) && sqlx migrate add --source ./config/migrations "$(name)"

machete:
	cargo machete

nursery:
	cargo clippy --all-features -- -D warnings -W clippy::pedantic -W clippy::nursery
