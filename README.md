[![npm version](https://badge.fury.io/js/@yveskaufmann%2Fretry.svg)](https://badge.fury.io/js/@yveskaufmann%2Fretry)
[![Node.js CI](https://github.com/yveskaufmann/retry/actions/workflows/ci.yml/badge.svg)](https://github.com/yveskaufmann/retry/actions/workflows/ci.yml)
[![codecov](https://codecov.io/gh/yveskaufmann/retry/branch/main/graph/badge.svg?token=QXZVS68R36)](https://codecov.io/gh/yveskaufmann/retry)

# @yveskaufmann/retry - retry-utility

Utility for retrying promise based operation on certain situations.

* Provides an imperative API.
* Class decorators to mark async functions to be retryable
  Supports various backoff strategies: fixed, linear, exponential.

## Installation

```sh 
npm install @yveskaufmann/retry
```

## Usage

The example below demonstrates how to annotate
methods to mark them as retryable. When `retryWhen`
return `true` the method is retried until it reaches the
`maxRetries` limit.

When the retry limit is reached last result is returned
or the last error is thrown.

When the limit is reached the last result, or the last thrown

> NOTE: The Retryable annotation only works with methods that returning promises like async methods.

```typescript
class Service {

  @Retryable({
    retryWhen: (result, err) => err != null,
    delay: Retry.Delays.linear(50),
    maxRetries: 3,
  })
  async retryOnAnyError() {
    // ...
  }

  @Retryable({
    retryWhen: (result, err) => err == null && result == false,
    delay: Retry.Delays.linear(50),
    maxRetries: 3,
  })
  async retryWhenFalseIsReturned() {
    return Math.random() < 0.6;
  }
}
```

This utility can also be used without annotating
class methods.

```typescript
 const response = await Retry.do({
  operation: () => client.get(...),
  retryWhen: (result, err) => HttpError.isTooManyRequest(err)
  maxRetries: 3,
  delay: Retry.Delays.constant(50),
});
```

## API

The API is documented in the provided typescript definition file.
