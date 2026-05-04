import { Retry, RetryOptions } from './retry';

export type DecoratedMethod = (...args: unknown[]) => unknown;

/**
 * An interface for a method decorator which supports both stage-2 and stage-3 decorator signatures.
 */
export interface HybridDecoratorMethodDecorator {
  /**
   * Overload for Stage 3 TC39 Decorator signature: (value, context)
   */
  <This, Args extends unknown[], Return>(
    target: (this: This, ...args: Args) => Return,
    context: ClassMethodDecoratorContext<This, (this: This, ...args: Args) => Return>
  ): (this: This, ...args: Args) => Return;

  /**
   * Overload for Stage 2 experimentalDecorators signature: (target, propertyKey, descriptor)
   */
  <T extends DecoratedMethod>(
    target: object,
    propertyKey: string | symbol,
    descriptor: TypedPropertyDescriptor<T>
  ): void;
}

/**
 * This method decorator marks a method as retryable.
 *
 * It uses the same options as {@link Retry#do} with the exception
 * that the operation is the annotated method.
 *
 * Supports both stage-2 (experimentalDecorators) and stage-3 (TC39) decorators.
 *
 * NOTE: The annotated method has to be async or must at least
 * return a Promise.
 *
 * @param options Configuration of the retry options
 */
export function Retryable<T>(options: RetryOptions<T>): HybridDecoratorMethodDecorator {
  return function (
    target: object | Function,
    contextOrKey: string | symbol | ClassMemberDecoratorContext | undefined,
    descriptor?: PropertyDescriptor
  ) {
    // Heuristic 1: New Standard Spec (TC39) Stage-3 Decorator: (value, context)
    const isStage3 =
      // biome-ignore lint/complexity/noArguments: We need paremeters strictly typed to define a stage 2-3 decorator type, so we have to use arguments.
      arguments.length === 2 &&
      typeof contextOrKey === 'object' &&
      contextOrKey !== null &&
      'kind' in contextOrKey;

    // Stage-3: (target, context)
    if (isStage3 && target instanceof Function) {
      // Stage-3: (originalMethod, context)
      return function (this: unknown, ...methodArgs: unknown[]) {
        const methodName = `${this?.constructor?.name ?? 'Unknown'}#${contextOrKey.name.toString()}`;
        return Retry.do({
          operation: () => target.apply(this, methodArgs),
          nameOfOperation: methodName,
          ...options,
        });
      };
    }

    // Stage-2: (target, propertyKey, descriptor)
    if (descriptor?.value instanceof Function) {
      const originalMethod = descriptor.value;
      const methodName = `${target.constructor.name}#${contextOrKey.toString()}`;
      descriptor.value = function (this: unknown, ...methodArgs: unknown[]) {
        return Retry.do({
          operation: () => originalMethod.apply(this, methodArgs),
          nameOfOperation: methodName,
          ...options,
        });
      };
    }
  };
}
