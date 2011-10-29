TESTS = $(shell find test/*.test.js)

test:
	@NODE_ENV=test expresso \
		$(TESTFLAGS) \
		$(TESTS)

test-cov:
	@TESTFLAGS=--cov $(MAKE) test

.PHONY: test test-cov
