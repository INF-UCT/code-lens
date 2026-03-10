ifneq (,$(wildcard ./.env))
    include .env
    export
endif

CLI=apps/cli
SERVER=apps/server
app ?= wiki
pkg ?=
service ?= $(app)

.DEFAULT_GOAL := run
.PHONY: cli run detach clean fmt lint migration machete nursery db-clean seed db gen-token npmi npmu

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

seed:
	docker exec -it code-lens-server /bin/bash -c "cd /app/apps/server && cargo run --bin seeder"

db:
	docker exec -it code-lens-postgres /bin/bash -c "psql -U user -d database"

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

npmi:
	cd apps/$(app) && npm install $(pkg)
	docker compose exec $(service) /bin/sh -c "cd /app/apps/$(app) && npm install $(pkg)"

npmu:
	cd apps/$(app) && npm uninstall $(pkg)
	docker compose exec $(service) /bin/sh -c "cd /app/apps/$(app) && npm uninstall $(pkg)"


gen-token:
	curl -s -X POST http://localhost/api/tokens/generate \
	-H "Content-Type: application/json" \
	-d '{"user_id": "$(USER_ID)", "repository_url": "$(REPO_URL)"}' | jq

ssh-ai:
	docker exec -it code-lens-wiki \
	ssh -o StrictHostKeyChecking=no \
	-o UserKnownHostsFile=/dev/null \
	-i /home/node/.ssh/id_ed25519 \
	lrevillod@172.24.250.47
