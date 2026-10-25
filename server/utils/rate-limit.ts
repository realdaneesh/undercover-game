export class RateLimiter {
  private buckets = new Map<string, { count: number; until: number }>();
  constructor(
    private limit: number,
    private windowMs: number,
  ) {}
  allow(key: string, now: number): boolean {
    let bucket = this.buckets.get(key);
    if (!bucket || now >= bucket.until) {
      bucket = { count: 0, until: now + this.windowMs };
      this.buckets.set(key, bucket);
    }
    return ++bucket.count <= this.limit;
  }
  cleanup(now: number): void {
    for (const [key, b] of this.buckets) if (now >= b.until) this.buckets.delete(key);
  }
}
