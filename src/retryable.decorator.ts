import { Retry, RetryOptions } from './retry';

/**
 * This method decorator marks a method as retriable.
 *
 * It uses the same options as @{link Retry#do} with the exception
 * that the operation is the annotated method.
 *
 * Supports both stage-2 (experimentalDecorators) and stage-3 (TC39) decorators.
 *
 * NOTE: That the annotated method have to be async or it should at least
 * return a promise.
 *
 * @param options Configuration of the retry options
 */
export function Retryable(options: RetryOptions<unknown>): any {
  return function (...args: any[]) {
    if (args.length === 3) {
      // Stage-2: (target, propertyKey, descriptor)
      const [target, property, descriptor] = args as [any, string | symbol, TypedPropertyDescriptor<any>];
      if (typeof descriptor.value !== 'function') {
        return;
      }
      const originalMethod = descriptor.value;
      const methodName = `${target.constructor.name}#${property.toString()}`;
      descriptor.value = function (this: any, ...methodArgs: any[]) {
        return Retry.do({
          operation: () => originalMethod.apply(this, methodArgs),
          nameOfOperation: methodName,
          ...options,
        });
      };
    } else {
      // Stage-3: (originalMethod, context)
      const [originalMethod, context] = args as [(...methodArgs: any[]) => any, ClassMethodDecoratorContext];
      return function (this: any, ...methodArgs: any[]) {
        // Class name is not available at decoration time in stage-3; resolve at call-time
        const methodName = `${this?.constructor?.name ?? 'Unknown'}#${context.name.toString()}`;
        return Retry.do({
          operation: () => originalMethod.apply(this, methodArgs),
          nameOfOperation: methodName,
          ...options,
        });
      };
    }
  };
}
