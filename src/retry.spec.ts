import { Retry, Retryable, MaxRetryAttemptsReached } from './retry';

class DummyClass {
  public count = 0;

  constructor() {
    this.count = 0;
  }

  @Retryable({
    retryWhen: () => true,
    maxRetries: 3,
  })
  public async testAttemptsExceedsRetries(): Promise<number> {
    return this.called();
  }

  @Retryable({
    retryWhen: () => true,
    maxRetries: 3,
    throwMaxAttemptError: true,
  })
  public async testThrowMaxAttemptError(): Promise<number> {
    return this.called();
  }

  @Retryable({
    retryWhen(result: any, error?: Error) {
      return result < -1;
    },
    maxRetries: 3,
  })
  public async testDontRetry(): Promise<number> {
    return this.called();
  }

  @Retryable({
    retryWhen: Retry.Conditions.always(),
    maxRetries: 3,
    delay: Retry.Delays.none(),
  })
  public async testWithNoDelay(): Promise<number> {
    return this.called();
  }

  @Retryable({
    retryWhen: Retry.Conditions.always(),
    maxRetries: 3,
    delay: Retry.Delays.constant(5),
  })
  public async testWithConstantDelay(): Promise<number> {
    return this.called();
  }

  @Retryable({
    retryWhen: Retry.Conditions.always(),
    maxRetries: 3,
    delay: Retry.Delays.linear(5),
  })
  public async testWithLinearDelay(): Promise<number> {
    return this.called();
  }

  public called(): number {
    return this.count++;
    // method is intended to spy on
  }
}

describe('Retryable', () => {
  let testClass: DummyClass;

  beforeEach(() => {
    testClass = new DummyClass();
  });

  afterEach(() => {
    jest.useRealTimers();
    jest.clearAllMocks();
  });

  it('Annotated method is called as so many times as it was configured via the maxRetries parameter + 1', async () => {
    const calledSpy = jest.spyOn(testClass, 'called');
    await testClass.testAttemptsExceedsRetries();
    expect(calledSpy).nthCalledWith(4);
  });

  it('result of the last attempt is returned if throwMaxAttemptError is false', async () => {
    const result = await testClass.testAttemptsExceedsRetries();
    expect(result).toBe(3);
  });

  it('error of the last attempt is returned if throwMaxAttemptError is false', async () => {
    const calledSpy = jest.spyOn(testClass, 'called');
    const err = new Error('key');
    (calledSpy as any).mockRejectedValue(err);
    await expect(testClass.testAttemptsExceedsRetries()).rejects.toThrow(err);
  });

  it('MaxAttemptError is thrown if all attempts exceeded the retry-limit and if throwMaxAttemptError is true ', async () => {
    const calledSpy = jest.spyOn(testClass, 'called');
    await expect(testClass.testThrowMaxAttemptError()).rejects.toThrowError(MaxRetryAttemptsReached);
    expect(calledSpy).nthCalledWith(4);
  });

  it('Do not retry if retryWhen returns false', async () => {
    const calledSpy = jest.spyOn(testClass, 'called');
    await testClass.testDontRetry();
    expect(calledSpy).nthCalledWith(1);
  });

  it('Do not wait between retries if none delay was used', async () => {
    jest.spyOn(global, 'setTimeout');
    await testClass.testWithNoDelay();

    expect(setTimeout).toHaveBeenCalledTimes(3);
    expect(setTimeout).toHaveBeenCalled();
    expect(setTimeout).toHaveBeenCalledWith(expect.any(Function), 0);
  });

  it('Do wait a fixed time between retries if constant delay was used', async () => {
    jest.spyOn(global, 'setTimeout');
    await testClass.testWithConstantDelay();

    expect(setTimeout).toHaveBeenCalledTimes(3);
    expect(setTimeout).toHaveBeenCalledWith(expect.any(Function), 5);
  });

  it('Do wait 5 * attemt time between retries if linear delay of 5 was used', async () => {
    jest.spyOn(global, 'setTimeout');
    await testClass.testWithLinearDelay();

    expect(setTimeout).toHaveBeenCalledTimes(3);
    expect(setTimeout).toHaveBeenNthCalledWith(1, expect.any(Function), 5);
    expect(setTimeout).toHaveBeenNthCalledWith(2, expect.any(Function), 10);
    expect(setTimeout).toHaveBeenNthCalledWith(3, expect.any(Function), 15);
  });
});
