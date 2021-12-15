/**
 * Creates an promise that resolves after the specified amount of time.
 *
 * @param waitForMs The amount of milliseconds this promise should wait until it's will be resolved.
 */
export function wait(waitForMs: number): Promise<void> {
  return new Promise((resolve) => {
    let timer = setTimeout(() => {
      clearTimeout(timer);
      timer = null;
      resolve();
    }, waitForMs);
  });
}
