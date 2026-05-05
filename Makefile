SHELL := bash

.default: build

.PHONY: build
build: node_modules
ifeq ($(CI), true)
	pnpm exec tsc -p tsconfig.build.json
else
	pnpm exec tsc -p .
endif

.PHONY: clean
clean:
	rm -rf dist

node_modules: package.json pnpm-lock.yaml
ifeq ($(CI), true)
	pnpm ci
else
	pnpm install
endif

.PHONY: test
test:
	pnpm exec vitest run

.PHONY: test-watch
test-watch:
	pnpm exec vitest

.PHONY: lint
lint:
	@if [[ "$$CI" == "true" ]]; then \
		pnpm exec biome ci; \
	else \
		pnpm exec biome check; \
	fi
.PHONY: lint-fix
lint-fix:
	pnpm exec biome check --fix

.PHONY: format
format:
	pnpm exec biome format --write

.PHONY: release
release:
	gh workflow run release.yml
