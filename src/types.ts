/**
 * ErrorClass is able to hold a reference to Error constructor.
 * It is used to pass over error classes to retry conditions in order define an specific Error type as retryable.
 *
 */
// biome-ignore lint/suspicious/noExplicitAny: Any is used to compatible with variety of Error constructors.
export type ErrorClass = new (...args: any[]) => Error;
