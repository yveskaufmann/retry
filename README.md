# @yveskaufmann/retry - retry-utility

[![npm version](https://badge.fury.io/js/@yveskaufmann%2Fretry.svg)](https://badge.fury.io/js/@yveskaufmann%2Fretry)
[![Node.js CI](https://github.com/yveskaufmann/retry/actions/workflows/ci.yml/badge.svg)](https://github.com/yveskaufmann/retry/actions/workflows/ci.yml)
[![codecov](https://codecov.io/gh/yveskaufmann/retry/branch/main/graph/badge.svg?token=QXZVS68R36)](https://codecov.io/gh/yveskaufmann/retry)
[![CodeQL](https://github.com/yveskaufmann/retry/actions/workflows/codeql-analysis.yml/badge.svg?branch=main)](https://github.com/yveskaufmann/retry/actions/workflows/codeql-analysis.yml)

Utility for retrying promise based operations when a certain response or error is returned.

* Provides an imperative API for non class methods.
* Provides Class decorators to mark async functions as retirable.
* Supports various backoff strategies: fixed, linear, exponential.

## Installation

```sh 
npm install @yveskaufmann/retry
```

## Usage

The examples below show how to annotate
methods to mark them as retirable. If `retryWhen`
returns `true` then the method will retried.
The limit of retries is given by `maxRetries`.

When the retry limit is reached, the last return value is returned
or the last thrown error is thrown.

> NOTE: The `Retryable` annotation only works with methods that return promise like async methods.

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

This utility can also be used with async functions:

```typescript
 const response = await Retry.do({
  operation: () => client.get(...),
  retryWhen: (result, err) => HttpError.isTooManyRequest(err)
  maxRetries: 3,
  delay: Retry.Delays.constant(50),
});
```

## API Reference

- [@yveskaufmann/retry - retry-utility](#yveskaufmannretry---retry-utility)
  - [Installation](#installation)
  - [Usage](#usage)
  - [API Reference](#api-reference)
    - [RetryOptions](#retryoptions)
    - [Retry](#retry)
    - [RetryDelays](#retrydelays)
    - [RetryConditions](#retryconditions)
    - [Retryable](#retryable)
    - [MaxRetryAttemptsReached](#maxretryattemptsreached)

### RetryOptions

```typescript 
/**
 * Options to configure a retriable operation.
 */
interface RetryOptions<T> {
  /**
   * The maximum amount of times a operation should be re-tried. 
   * Excluding the *initial attempt.
   */
  maxRetries?: number;

  /**
   * When set to true a MaxRetryAttemptsReached will be thrown if 
   * the retry attempts limit is reached.
   *
   * You should not use this option, 
   * if you are interested into result/error that was produced 
   * by the operation.
   */
  throwMaxAttemptError?: boolean;

  /**
   * Helps to identify the retryable operation in errors 
   * and logs.
   */
  nameOfOperation?: string;

  /**
   * The max number of milliseconds between two retries. Default is `Unlimited`
   */
  maxDelay?: number;

  /**
   * Defines the condition on which a operation should be 
   * retried, a implementation should return true 
   * if a retry is desired.
   *
   * @param result The result from the current attempt, 
   * can be null if no error was thrown by the operation.
   * 
   * @param error  The error that was thrown by the operation 
   * during the latest attempt.
   *
   * @returns True if a retry should be done.
   *
   */
  retryWhen: (result: T, err: Error) => boolean;

  /**
   * Calculates the delay between retries in milliseconds.
   *
   * @param attempts Count of failed attempts
   * 
   * @param error The error that was thrown by the operation 
   *  during the previous attempt.
   *
   * @returns A delay duration in  milliseconds.
   */
  delay?: (attempts: number, error?: Error) => number;

 /**
   * Will be invoked after each failed attempt.
   * An atempt is to be considered failed, if the `retryWhen` classify a returned error/return-values as retryable.

   * @param attempt The number of the attempt.
   * @param attemptsLeft The number of attempts left.

   * @param result The returned value from the retryable operation, that is considered be a reason to perform a retry
   * @param err The cause of the failed attempt
   * @returns
   */
  onFailedAttempt?: (attempt: number, attemptsLeft: number, result: T, err: Error) => void;
}
```

### Retry

This is the retry class that provides access to built-in delay(backoff) strategies and built-in retry conditions.

```typescript
class Retry {
  /**
   * List of built-in delays
   */
  public static readonly Delays = new Delays();

  /**
   * List of built-in retry conditions
   */
  public static readonly Conditions = new Conditions();
 
 /**
   * The do function invokes a given operation,
   * and will re-invoke this operation if 
   * @link{RetryOptions#retryWhen} returns true.
   * (@link{RetryOptions#retryWhen} will be provided with the operations result)
   * 
   * The operation will not be further retried if the 
   * @link{RetryOptions#maxRetries} limit is reached, 
   * in this case either the return value from the previous 
   * operation invocation is returned or the error that
   * was last thrown by the invoked operation will be thrown.
   *
   * @param options Configuration of the retry options
   *
   * @throws MaxRetryAttemptsReached if the retry attempt limit 
   * is reached and the option @link{RetryOptions#throwMaxAttemptError} 
   * was enabled  otherwise the error from the last invocation 
   * will be thrown.
   *
   * @returns The result of the last operation invocation.
   */
  public static async do<T>(options: RetryOptions<T>): Promise<T>;
}
```

### RetryDelays

```typescript 
/**
 * List of built-in delay strategies.
 */
class Delays {
  /**
   * No delay between retries
   */
  public none();

  /**
   * Constant delay in milliseconds between retries.
   */
  public constant(delayInMs: number);

  /**
   * Linear sloping delay per attempt
   */
  public linear(delayInMs: number);
  
  /**
   * Quadratic sloping delays per attempt
   */
  public potential(delayInMs: number);
}
```

A custom delay strategy can be created by implementing 
a function that fulfills the interface below:

```typescript 
  /**
   * Calculates the delay between retries in milliseconds.
   *
   * @param attempts Count of failed attempts
   * @param error The error that was thrown by the operation 
   * during the previous attempt.
   *
   * @returns A delay duration in  milliseconds.
   */
  () => (attempts: number, error?: Error) => number
```

### RetryConditions

```typescript 
/**
 * List of built-in retry conditions.
 */
class Conditions {
  /**
   * Retries a operation on any thrown error.
   */
  public onAnyError();

  /**
   * Retries a operation in any case.
   */
  public always();

  /**
   * Retries a operation if it returned a nullthy value.
   */
  public onNullResult();
}
```

A custom retry-condition can be created by implementing 
a function that fulfills the following interface:

```typescript 
 /**
   * Defines the condition on which a operation should be retried a implementation
   * should return true if a retry is desired.
   *
   * @param result The result from the current attempt, can be null if no error was thrown by the operation.
   * @param error  The error that was thrown by the operation during the current attempt.
   *
   * @returns True if a retry should be done.
   *
   */
  retryWhen: (result: T, err: Error) => boolean;
```

### Retryable

```typescript 
/**
 * This method decorator marks a method as retriable.
 *
 * It uses the same options as @{link Retry#do} with the exception
 * that the operation is the annotated method.
 *
 * NOTE: That the annotated method has to be async or it should at least
 * return a promise.
 *
 * @param options Configuration of the retry options
 */
function Retryable(options: RetryOptions<unknown>): MethodDecorator
```

### MaxRetryAttemptsReached

```typescript 
/**
 * This error will be thrown if the maximum retry attempts of a
 * operation is reached buf only if @{link RetryOptions#throwMaxAttemptError} was set to true.
 */
class MaxRetryAttemptsReached extends Error {
  /**
   * Can contain the cause of this error,
   * which follows the specs of Error Cause proposal:
   *
   * https://tc39.es/proposal-error-cause/
   */
  public readonly cause: Error;

  constructor(message: string, cause?: Error);
}
```
