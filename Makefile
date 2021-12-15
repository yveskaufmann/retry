SHELL := bash

.default: build

.PHONY: build
build: node_modules
	npx tsc -p tsconfig.build.json

node_modules: package.json package-lock.json
	npm install

.PHONY: test
test:
	npx jest $(TEST_ARGS)

.PHONY: test-watch
test-watch:
	$(MAKE) test TEST_ARGS=--watch

.PHONY: clean
clean:
	rm -rf dist
