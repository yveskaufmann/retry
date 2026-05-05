SHELL := bash

.default: build

.PHONY: build
build: node_modules
ifeq ($(CI), true)
	npx tsc -p tsconfig.build.json
else
	npx tsc -p .
endif

.PHONY: clean
clean:
	rm -rf dist

node_modules: package.json package-lock.json
ifeq ($(CI), true)
	npm ci
else
	npm install
endif

.PHONY: test
test:
	npx vitest run

.PHONY: test-watch
test-watch:
	npx vitest

.PHONY: lint
lint:
	@if [[ "$$CI" == "true" ]]; then \
		npx biome ci; \
	else \
		npx biome check; \
	fi
.PHONY: lint-fix
lint-fix:
	npx biome check --fix

.PHONY: format
format:
	npx biome format --write

.PHONY: release
release:
	gh workflow run release.yml
