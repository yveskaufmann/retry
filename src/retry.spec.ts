import { Retry, MaxRetryAttemptsReached } from './retry';
import { Retryable } from './retryable.decorator';

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
      const condition = Retry.Conditions.custom<number>()
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

describe('Attempt tracking', () => {
  class AttemptDummy {
    #invocations = 0;

    @Retryable({
      retryWhen: Retry.Conditions.always(),
      maxRetries: 3,
    })
    async retryWithAllAttempts() {
      return { attempts: Retry.getAttempt(), lastAttempt: Retry.isLastAttempt(), attemptsLeft: Retry.getAttemptLeft() };
    }

    @Retryable({
      retryWhen: Retry.Conditions.custom()
        .onCondition(() => false)
        .toCondition(),
      maxRetries: 3,
    })
    async retryWithNoAttempts() {
      return { attempts: Retry.getAttempt(), lastAttempt: Retry.isLastAttempt(), attemptsLeft: Retry.getAttemptLeft() };
    }

    @Retryable({
      retryWhen: Retry.Conditions.custom()
        .onCondition((result: any) => typeof result?.attempts === 'number' && result?.attempts < 2)
        .toCondition(),
      maxRetries: 3,
    })
    async retryOnSecondeAttempt() {
      if (this.#invocations++ < 1) {
        return { attempts: -1, lastAttempt: false, attemptsLeft: 0 };
      }

      return { attempts: Retry.getAttempt(), lastAttempt: Retry.isLastAttempt(), attemptsLeft: Retry.getAttemptLeft() };
    }
  }

  describe('getAttempt', () => {
    it('throw error when not called in async context', async () => {
      expect(Retry.getAttempt).toThrow('getAttempt can only be called within a retryable operation');
    });

    it('returns the attempts that were made before calling getAttempt', async () => {
      const dummy = new AttemptDummy();
      const { attempts } = await dummy.retryWithAllAttempts();
      expect(attempts).toBe(4);

      const { attempts: noAttempts } = await dummy.retryWithNoAttempts();
      expect(noAttempts).toBe(1);

      const { attempts: secondAttempt } = await dummy.retryOnSecondeAttempt();
      expect(secondAttempt).toBe(2);
    });
  });

  describe('isLastAttempt', () => {
    it('throw error when not called in async context', async () => {
      expect(Retry.isLastAttempt).toThrow('isLastAttempt can only be called in a retryable operation');
    });

    it('returns true if the current attempt is the last one', async () => {
      const dummy = new AttemptDummy();
      const { lastAttempt } = await dummy.retryWithAllAttempts();
      expect(lastAttempt).toBe(true);
    });

    it('returns false if the current attempt is not the last one', async () => {
      const dummy = new AttemptDummy();
      const { lastAttempt } = await dummy.retryOnSecondeAttempt();
      expect(lastAttempt).toBe(false);
    });
  });

  describe('getAttemptLeft', () => {
    it('throw error when not called in async context', async () => {
      expect(Retry.getAttemptLeft).toThrow('getAttemptLeft can only be called in a retryable operation');
    });

    it('returns the attempts left including the current attempt', async () => {
      const dummy = new AttemptDummy();
      const { attemptsLeft } = await dummy.retryWithAllAttempts();
      expect(attemptsLeft).toBe(0);

      const { attemptsLeft: noAttemptsLeft } = await dummy.retryWithNoAttempts();
      expect(noAttemptsLeft).toBe(3);

      const { attemptsLeft: secondAttemptLeft } = await dummy.retryOnSecondeAttempt();
      expect(secondAttemptLeft).toBe(2);
    });
  });
});
