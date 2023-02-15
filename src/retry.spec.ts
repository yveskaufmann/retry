import { Retry, Retryable, MaxRetryAttemptsReached } from './retry';

describe('Retryable', () => {
  const onAttemptMock = jest.fn();

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

    @Retryable({
      retryWhen: Retry.Conditions.always(),
      maxRetries: 3,
      delay: Retry.Delays.linear(5),
      maxDelay: 10,
    })
    public async testWithLimitedLinearDelay(): Promise<number> {
      return this.called();
    }
    @Retryable({
      retryWhen: Retry.Conditions.always(),
      maxRetries: 3,
      delay: Retry.Delays.linear(5),
      onFailedAttempt: onAttemptMock,
    })
    public async testWithOnFailedAttempt(): Promise<number> {
      return this.called();
    }

    public called(): number {
      return this.count++;
      // method is intended to spy on
    }
  }

  let testClass: DummyClass;

  beforeEach(() => {
    onAttemptMock.mockReset();
    testClass = new DummyClass();
  });

  afterEach(() => {
    jest.useRealTimers();
    jest.clearAllMocks();
  });

  it('The retryable annotation has no effect on classes or parameters', () => {
    const value = {};
    const descriptor = {
      value,
    };

    Retryable({
      retryWhen: Retry.Conditions.always(),
      maxRetries: 3,
    })(null, '', descriptor);

    expect(descriptor.value).toEqual(value);
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

  it('Do only wait for the specified `maxDelay`', async () => {
    jest.spyOn(global, 'setTimeout');
    await testClass.testWithLimitedLinearDelay();

    expect(setTimeout).toHaveBeenCalledTimes(3);
    expect(setTimeout).toHaveBeenNthCalledWith(1, expect.any(Function), 5);
    expect(setTimeout).toHaveBeenNthCalledWith(2, expect.any(Function), 10);
    expect(setTimeout).toHaveBeenNthCalledWith(3, expect.any(Function), 10);
  });

  it('invokes onAttempt after each attempt', async () => {
    jest.spyOn(global, 'setTimeout');
    await testClass.testWithOnFailedAttempt();

    expect(onAttemptMock).toHaveBeenCalledTimes(4);
  });
});

describe('Retry#do default parameters', () => {
  afterEach(() => {
    jest.useRealTimers();
    jest.clearAllMocks();
  });

  it('default maxRetries are 2 times', async () => {
    const callback = jest.fn().mockResolvedValue(0);
    await Retry.do({
      operation: callback,
      retryWhen: Retry.Conditions.always(),
    });

    expect(callback).toHaveBeenCalledTimes(3);
  });

  it('default delay strategy is none', async () => {
    jest.spyOn(global, 'setTimeout');

    const callback = jest.fn().mockResolvedValue(0);

    await Retry.do({
      operation: callback,
      retryWhen: Retry.Conditions.always(),
      maxRetries: 2,
    });

    expect(setTimeout).toHaveBeenNthCalledWith(1, expect.any(Function), 0);
    expect(setTimeout).toHaveBeenNthCalledWith(2, expect.any(Function), 0);
  });
});

describe('Delays', () => {
  describe('#none', () => {
    it.each([-1, 0, 1, 10])('returns zero [attempts=%d]', (attempts) => {
      const delay = Retry.Delays.none();
      expect(delay(attempts)).toBe(0);
    });
  });

  describe('#constant', () => {
    it.each([-1, 0, 1, 10])('returns constant delay [attempts=%d]', (attempts) => {
      const delay = Retry.Delays.constant(15);
      expect(delay(attempts)).toBe(15);
    });
  });

  describe('#linear', () => {
    it.each([-1, 0, 1, 10])('returns the delay: amountOfAttempts * delay [attempts=%d]', (attempts) => {
      const delay = Retry.Delays.linear(5);
      expect(delay(attempts)).toBe(5 * attempts);
    });
  });

  describe('#potential', () => {
    it('returns the delay: 2**amountOfAttempts * delay', () => {
      const delay = Retry.Delays.potential(5);
      expect(delay(-1)).toBe(5);
      expect(delay(0)).toBe(5);
      expect(delay(1)).toBe(5);
      expect(delay(2)).toBe(10);
      expect(delay(3)).toBe(20);
      expect(delay(5)).toBe(80);
    });
  });
});

describe('Conditions', () => {
  describe('onAnyError', () => {
    it('Returns true if any error was specfied as argument', () => {
      const conditon = Retry.Conditions.onAnyError();
      expect(conditon(null, new Error())).toBeTruthy();
      expect(conditon(null, null as any)).toBeFalsy();
      expect(conditon(null, undefined as any)).toBeFalsy();
    });
  });

  describe('always', () => {
    it('Returns always true', () => {
      const conditon = Retry.Conditions.always();
      expect(conditon(null, new Error())).toBeTruthy();
      expect(conditon(1, undefined)).toBeTruthy();
    });
  });

  describe('onNullResult', () => {
    it('Returns true if a null result was returned', () => {
      const conditon = Retry.Conditions.onNullResult();
      expect(conditon(null, new Error())).toBeFalsy();
      expect(conditon(1, undefined)).toBeFalsy();
      expect(conditon(null, undefined)).toBeTruthy();
    });
  });

  describe('custom - allows to aggregate custom conditions', () => {
    it('returns a conditon builder', () => {
      const custom = Retry.Conditions.custom();
      expect(typeof custom).toBe('object');
      expect(custom).toHaveProperty('toCondition');
      expect(typeof custom.toCondition).toBe('function');
    });

    it('#toCondition returns a condition function which returns by default false', () => {
      const condition = Retry.Conditions.custom().toCondition();
      expect(condition(null, null)).toBe(false);
    });

    it('#onError allows to mark specific erros as retryable', () => {
      const condition = Retry.Conditions.custom().onError(TypeError).toCondition();
      expect(condition(null, new Error('retry me not'))).toBe(false);
      expect(condition(null, new TypeError('retry me'))).toBe(true);
    });

    it('#onCondition allows to specifiy conditions for a retry', () => {
      const condition = Retry.Conditions.custom()
        .onCondition((result) => typeof result != 'number')
        .onCondition((result) => result > 10)
        .toCondition();

      expect(condition(null, null)).toBe(true);
      expect(condition(11, null)).toBe(true);
      expect(condition(1, null)).toBe(false);
    });
  });
});

describe('MaxRetryAttemptsReached', () => {
  describe('Constructor', () => {
    it('Includes the cause into the message if one was specified', () => {
      const withNoCause = new MaxRetryAttemptsReached('noCause');
      expect(withNoCause.message).toBe('noCause Caused by: unfulfilled retry condition');
      expect(withNoCause.cause).toBeUndefined();

      const withCause = new MaxRetryAttemptsReached('withCause', new Error('cause'));
      expect(withCause.message).toBe(`withCause Caused by thrown error: cause`);
      expect(withCause.cause).toBeDefined();
      expect(withCause.cause.message).toBe('cause');
    });
  });
});
