# CarMaintenance — operations Makefile.
# Use `make help` to list targets. Recipes assume `docker compose` v2.

SHELL          := /bin/bash
COMPOSE        := docker compose
BACKEND_SVC    := backend
FRONTEND_SVC   := frontend
PROXY_SVC      := proxy
DATA_VOLUME    := carm_data
BACKUP_DIR     := ./backups

# Overridable defaults.
SERVICE        ?=
DEPLOY_HOST    ?= h61user@192.168.100.63
DEPLOY_PATH    ?= ~/CarMaintenance

# UTC timestamp for backup folder names.
TIMESTAMP      := $(shell date -u +%Y-%m-%dT%H-%M-%SZ)

.DEFAULT_GOAL  := help

.PHONY: help up down restart logs ps build migrate migrate-supabase \
        shell-backend shell-frontend shell-proxy backup restore \
        test-backend test-frontend clean deploy deploy-logs remote-shell

help: ## Show this help.
	@printf "CarMaintenance — make targets\n\n"
	@awk 'BEGIN {FS = ":.*?## "} /^[a-zA-Z_-]+:.*?## / {printf "  \033[1m%-20s\033[0m %s\n", $$1, $$2}' $(MAKEFILE_LIST)
	@printf "\nVariables:\n"
	@printf "  DEPLOY_HOST=%s\n" "$(DEPLOY_HOST)"
	@printf "  DEPLOY_PATH=%s\n" "$(DEPLOY_PATH)"
	@printf "  SERVICE=%s (used by 'logs')\n" "$(SERVICE)"

up: ## Build images and start the stack in the background.
	$(COMPOSE) up -d --build

down: ## Stop and remove containers (keeps volumes).
	$(COMPOSE) down

restart: ## Restart the stack (down + up).
	$(MAKE) down
	$(MAKE) up

logs: ## Tail logs. Use SERVICE=backend to follow one service.
	@if [ -n "$(SERVICE)" ]; then \
		$(COMPOSE) logs -f $(SERVICE); \
	else \
		$(COMPOSE) logs -f; \
	fi

ps: ## Show service status.
	$(COMPOSE) ps

build: ## Build images without starting them.
	$(COMPOSE) build

migrate: ## Apply backend SQL migrations inside the running container.
	$(COMPOSE) exec $(BACKEND_SVC) npm run migrate

migrate-supabase: ## One-shot Supabase -> SQLite import (needs server/.env keys).
	@if ! grep -q '^SUPABASE_URL=..*' server/.env 2>/dev/null; then \
		echo "ERROR: SUPABASE_URL is missing or empty in server/.env"; exit 1; \
	fi
	@if ! grep -q '^SUPABASE_SERVICE_ROLE_KEY=..*' server/.env 2>/dev/null; then \
		echo "ERROR: SUPABASE_SERVICE_ROLE_KEY is missing or empty in server/.env"; exit 1; \
	fi
	$(COMPOSE) exec $(BACKEND_SVC) npm run migrate:supabase

shell-backend: ## Open a shell in the backend container.
	$(COMPOSE) exec $(BACKEND_SVC) sh

shell-frontend: ## Open a shell in the frontend container.
	$(COMPOSE) exec $(FRONTEND_SVC) sh

shell-proxy: ## Open a shell in the proxy container.
	$(COMPOSE) exec $(PROXY_SVC) sh

backup: ## Snapshot SQLite + uploads from the data volume into ./backups/<UTC>.
	@mkdir -p $(BACKUP_DIR)/$(TIMESTAMP)
	@echo "Backing up volume '$(DATA_VOLUME)' -> $(BACKUP_DIR)/$(TIMESTAMP)"
	docker run --rm \
		-v $(DATA_VOLUME):/data:ro \
		-v $(abspath $(BACKUP_DIR)/$(TIMESTAMP)):/backup \
		alpine sh -c "cp -a /data/. /backup/ && ls -la /backup"
	@echo "Backup complete: $(BACKUP_DIR)/$(TIMESTAMP)"

restore: ## Restore a backup. Usage: make restore FROM=./backups/<dir> [CONFIRM=1].
	@if [ -z "$(FROM)" ]; then \
		echo "ERROR: FROM=<path> is required (e.g. FROM=$(BACKUP_DIR)/2026-05-05T12-00-00Z)"; exit 1; \
	fi
	@if [ ! -d "$(FROM)" ]; then \
		echo "ERROR: $(FROM) is not a directory"; exit 1; \
	fi
	@if [ -t 0 ] && [ -z "$(CONFIRM)" ]; then \
		read -p "Overwrite volume '$(DATA_VOLUME)' from $(FROM)? [y/N] " ans; \
		case "$$ans" in y|Y|yes|YES) ;; *) echo "Aborted."; exit 1 ;; esac; \
	elif [ -z "$(CONFIRM)" ]; then \
		echo "ERROR: non-interactive shell — re-run with CONFIRM=1"; exit 1; \
	fi
	@echo "Stopping backend..."
	-$(COMPOSE) stop $(BACKEND_SVC)
	docker run --rm \
		-v $(DATA_VOLUME):/data \
		-v $(abspath $(FROM)):/backup:ro \
		alpine sh -c "rm -rf /data/* /data/.[!.]* 2>/dev/null; cp -a /backup/. /data/ && ls -la /data"
	@echo "Restarting backend..."
	$(COMPOSE) start $(BACKEND_SVC)
	@echo "Restore complete."

test-backend: ## Run backend tests in a one-off container.
	$(COMPOSE) run --rm $(BACKEND_SVC) npm test

test-frontend: ## Run frontend tests on the host (image is a static nginx, not a node runtime).
	npm run test:run

clean: ## DESTROY containers and the data volume. Requires CONFIRM=1.
	@if [ -z "$(CONFIRM)" ]; then \
		echo "ERROR: this will delete the '$(DATA_VOLUME)' volume. Re-run with CONFIRM=1"; exit 1; \
	fi
	$(COMPOSE) down -v

deploy: ## Sync the repo to the VPS and bring the stack up there.
	@echo "Deploying to $(DEPLOY_HOST):$(DEPLOY_PATH)"
	rsync -av --delete \
		--exclude node_modules \
		--exclude dist \
		--exclude backups \
		--exclude .git \
		--exclude .DS_Store \
		./ $(DEPLOY_HOST):$(DEPLOY_PATH)/
	ssh $(DEPLOY_HOST) 'cd $(DEPLOY_PATH) && docker compose up -d --build && docker compose exec -T backend npm run migrate'

deploy-logs: ## Tail remote stack logs over SSH.
	ssh $(DEPLOY_HOST) 'cd $(DEPLOY_PATH) && docker compose logs --tail=200 -f'

remote-shell: ## Open an interactive SSH session at $(DEPLOY_PATH).
	ssh -t $(DEPLOY_HOST) 'cd $(DEPLOY_PATH) && exec $$SHELL -l'
