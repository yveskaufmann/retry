import { wait } from './wait';

/**
 * Options to configure a retriable operation.
 */
export interface RetryOptions<T> {
  /**
   * The maximum amount of times a operation should be re-tried. Excluding the initial attempt.
   */
  maxRetries?: number;

  /**
   * When set to true a MaxRetryAttemptsReached will be thrown if
   * the retry attempt limit is reached.
   *
   * You should not use this option if you are interested into result/error that
   * was produced by the operation.
   */
  throwMaxAttemptError?: boolean;

  /**
   * Helps to identify the retryable operation in errors
   * and logging.
   */
  nameOfOperation?: string;

  /**
   * The max number of milliseconds between two retries. Default is `Unlimited`
   */
  maxDelay?: number;

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
  retryWhen: RetryCondition;

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

  /**
   * Calculates the delay between retries in milliseconds.
   *
   * @param attempts Count of failed attempts
   * @param error The error that was thrown by the operation during the previous attempt.
   *
   * @returns A delay duration in  milliseconds.
   */
  delay?: (attempts: number, error?: Error) => number;
}

/**
 * List of built-in delay strategies.
 */
class Delays {
  /**
   * No delay between retries
   */
  public none() {
    return (attempts: number) => 0;
  }

  /**
   * Constant delay in milliseconds between retries.
   */
  public constant(delayInMs: number) {
    return (attempts: number) => delayInMs;
  }

  /**
   * Linear slope per attempt;
   */
  public linear(delayInMs: number) {
    return (attempts: number) => attempts * delayInMs;
  }

  /**
   * Quadratic slope per attempt
   */
  public potential(delayInMs: number) {
    return (attempts: number) => Math.pow(2, Math.max(attempts - 1, 0)) * delayInMs;
  }
}

/**
 * List of built-in retry conditions.
 */
class Conditions {
  /**
   * Retries a operation on any thrown error.
   */
  public onAnyError() {
    return (result: unknown, err: Error) => err != null;
  }

  /**
   * Retries a operation in any case.
   */
  public always() {
    return (result: unknown, err: Error) => true;
  }

  /**
   * Retries a operation if it returned a nullthy value.
   */
  public onNullResult() {
    return (result: unknown, err: Error) => err == null && result == null;
  }
}

export class Retry {
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
   * and will re-invoke this operation if @link{RetryOptions#retryWhen}
   * applied with the operation reults returns true.
   *
   * The operation will not further retried if the @link{RetryOptions#maxRetries}
   * limit is reached, in this case either the return value
   * from the previous operation invocation is returned or the error that
   * was last thrown by invoked operation will be thrown by the do method.
   *
   * @param options Configuration of the retry options
   *
   * @throws MaxRetryAttemptsReached if the retry attempt limit is reached and the option @link{RetryOptions#throwMaxAttemptError}
   * was enabled otherwise the error from the last invocation will be thrown.
   *
   * @returns The result of the last operation invocation.
   *
   */
  public static async do<T>({
    operation,
    retryWhen: retryCondition,
    maxRetries,
    delay,
    throwMaxAttemptError,
    nameOfOperation,
    maxDelay,
    onFailedAttempt,
  }: {
    operation: () => Promise<T>;
  } & RetryOptions<T>): Promise<T> {
    maxRetries = maxRetries ?? 2;
    delay = delay ?? Retry.Delays.none();

    let attempts = 0;
    let shouldRetry = false;
    let attemptsLeft = true;
    let result = null;
    let previousError: Error = null;

    do {
      try {
        result = await operation();
        previousError = null;
      } catch (err) {
        previousError = err as Error;
      }

      shouldRetry = retryCondition(result, previousError);
      if (!shouldRetry) {
        break;
      }

      if (typeof onFailedAttempt === 'function') {
        onFailedAttempt(attempts + 1, maxRetries - attempts, result, previousError);
      }

      attemptsLeft = attempts++ < maxRetries;
      shouldRetry = shouldRetry && attemptsLeft;
      if (shouldRetry) {
        let delayDuration = delay(attempts, previousError);
        if (typeof maxDelay === 'number' && maxDelay > 0) {
          delayDuration = Math.min(maxDelay, delayDuration);
        }
        await wait(delayDuration);
      }
    } while (shouldRetry);

    if (throwMaxAttemptError && !attemptsLeft) {
      throw new MaxRetryAttemptsReached(
        `Max re-attempts of ${attempts} reached for operation "${nameOfOperation ?? operation.name}".`,
        previousError
      );
    }

    if (previousError) {
      throw previousError;
    }

    return result;
  }
}

/**
 * This error will be thrown if the maximum retry attempts of a
 * operation is reached buf only if @{link RetryOptions#throwMaxAttemptError} was set to true.
 */
export class MaxRetryAttemptsReached extends Error {
  /**
   * Can contain the cause of this error,
   * which follows the specs of Error Cause proposal:
   *
   * https://tc39.es/proposal-error-cause/
   */
  public readonly cause: Error;

  constructor(message: string, cause?: Error) {
    super(message);
    this.cause = cause;
    if (cause) {
      this.message += ` Caused by thrown error: ${cause.message}`;
    } else {
      this.message += ` Caused by: unfulfilled retry condition`;
    }

    if (typeof Error.captureStackTrace === 'function') {
      Error.captureStackTrace(this, this.constructor);
    }
  }
}

/**
 * This method decorator marks a method as retriable.
 *
 * It uses the same options as @{link Retry#do} with the execption
 * that the operation is the annotated method.
 *
 * NOTE: That the annotated method have to be async or it should at east
 * return a promise.
 *
 * @param options Configuration of the retry options
 */
export function Retryable(options: RetryOptions<unknown>): MethodDecorator {
  return function (target, property, descriptor: TypedPropertyDescriptor<any>) {
    if (typeof descriptor.value != 'function') {
      return;
    }

    const originalMethod = descriptor.value;
    const methodName = `${target.constructor.name}#${property.toString()}`;

    descriptor.value = function (...args: any[]) {
      return Retry.do({
        operation: () => originalMethod.apply(this, args),
        nameOfOperation: methodName,
        ...options,
      });
    };
  };
}
