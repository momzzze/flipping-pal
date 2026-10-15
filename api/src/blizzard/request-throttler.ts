/**
 * Limits concurrent requests and requests per second (sliding one-second window).
 * Blizzard enforces 100 req/s and 36,000 req/hour per client; we stay well below.
 */
export class RequestThrottler {
  private active = 0;
  private readonly queue: Array<() => void> = [];
  private readonly startTimes: number[] = [];

  constructor(
    private readonly maxConcurrency: number,
    private readonly maxPerSecond: number,
    private readonly now: () => number = () => Date.now(),
    private readonly sleep: (ms: number) => Promise<void> = (ms) =>
      new Promise((resolve) => setTimeout(resolve, ms)),
  ) {}

  async schedule<T>(task: () => Promise<T>): Promise<T> {
    await this.acquireSlot();
    try {
      await this.waitForRateWindow();
      return await task();
    } finally {
      this.release();
    }
  }

  private acquireSlot(): Promise<void> {
    if (this.active < this.maxConcurrency) {
      this.active += 1;
      return Promise.resolve();
    }
    return new Promise((resolve) => {
      this.queue.push(() => {
        this.active += 1;
        resolve();
      });
    });
  }

  private release(): void {
    this.active -= 1;
    const next = this.queue.shift();
    if (next) next();
  }

  private async waitForRateWindow(): Promise<void> {
    for (;;) {
      const current = this.now();
      while (
        this.startTimes.length > 0 &&
        current - this.startTimes[0] >= 1000
      ) {
        this.startTimes.shift();
      }
      if (this.startTimes.length < this.maxPerSecond) {
        this.startTimes.push(current);
        return;
      }
      await this.sleep(1000 - (current - this.startTimes[0]) + 1);
    }
  }
}
