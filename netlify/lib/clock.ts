// The injected clock (ADR 0006). FAKE_NOW is honored only in local and test (Env.fakeNow is null elsewhere).
import { normalizeInstant, type Clock } from "../../shared/datetime";

export const systemClock: Clock = { now: () => new Date().toISOString() };

export function fixedClock(iso: string): Clock {
  const fixed = normalizeInstant(iso);
  if (!fixed) throw new Error("fixedClock needs an ISO instant with an offset");
  return { now: () => fixed };
}

/** A clock a test can move forward. */
export function steppingClock(startIso: string): Clock & { advanceMinutes(n: number): void; set(iso: string): void } {
  let current = normalizeInstant(startIso);
  if (!current) throw new Error("steppingClock needs an ISO instant with an offset");
  return {
    now: () => current as string,
    advanceMinutes(n: number) {
      current = new Date(Date.parse(current as string) + n * 60000).toISOString();
    },
    set(iso: string) {
      const n = normalizeInstant(iso);
      if (!n) throw new Error("bad instant");
      current = n;
    },
  };
}

export function clockFromEnv(fakeNow: string | null): Clock {
  return fakeNow ? fixedClock(fakeNow) : systemClock;
}
