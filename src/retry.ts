import { wait } from './wait';

export interface RetryOptions<T> {
  /**
   * The maximum amount of times a operation should be re-tried. Excluding the initial attempt.
   */
  maxRetries?: number;

  /**
   * When set to true a MaxRetryAttemptsReached will be thrown if the max attempts of retries
   * is reached.
   *
   * You should not use this option if you are interested into result/error that
   * was produced by the operation in the last retry attempt.
   */
  throwMaxAttemptError?: boolean;

  /**
   * Helps to identify the retryable operation in produced errors and logging.
   */
  nameOfOperation?: string;

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

class Delays {
  /**
   * No delay between retries
   */
  public none() {
    return (attempts: number) => 0;
  }

  /**
   * Constant delay between retries.
   */
  public constant(delay: number) {
    return (attempts: number) => delay;
  }

  /**
   * Linear slope per attempt;
   */
  public linear(delay: number) {
    return (attempts: number) => attempts * delay;
  }

  /**
   * Quadratic slope per attempt
   */
  public potential(delay: number) {
    return (attempts: number) => Math.pow(2, Math.max(attempts - 1, 0)) * delay;
  }
}

class Conditions {
  public onAnyError() {
    return (result: unknown, err: Error) => err != null;
  }

  public always() {
    return (result: unknown, err: Error) => true;
  }

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
   *
   * @param param0
   * @returns
   */
  public static async do<T>({
    operation,
    retryWhen: retryCondition,
    maxRetries,
    delay,
    throwMaxAttemptError,
    nameOfOperation,
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

      attemptsLeft = attempts++ < maxRetries;
      shouldRetry = shouldRetry && attemptsLeft;
      if (shouldRetry) {
        const delayDuration = delay(attempts, previousError);
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
 * operation are reached.
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
