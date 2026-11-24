import assert from "node:assert/strict";
import { EventEmitter } from "node:events";
import test from "node:test";
import type { Campaign } from "./campaign";
import {
  CampaignScheduler,
  CLOCK_CHECK_INTERVAL_MS,
  MAX_TIMER_DELAY_MS,
  type SchedulerTimers,
} from "./campaign-scheduler";

const START = Date.parse("2026-11-27T06:00:00Z");
const END = Date.parse("2026-12-01T05:59:59Z");

const sale: Campaign = {
  id: "black-friday-2026",
  enabled: true,
  headline: "Black Friday Sale: 25% off everything",
  body: "Use code BLACKFRIDAY25 at checkout. Ends Monday at midnight.",
  code: "BLACKFRIDAY25",
  ctaLabel: "Shop the sale",
  ctaUrl: "http://localhost/",
  startsAt: "2026-11-27T00:00:00-06:00",
  endsAt: "2026-11-30T23:59:59-06:00",
  notifyOnStart: true,
  theme: { background: "#111111", text: "#FFFFFF", accent: "#FFC233", accentText: "#111111" },
};

type Pending = { id: number; callback: () => void; delayMs: number };

function harness(startAt: number, campaign: Campaign | null = sale) {
  let clock = startAt;
  let nextId = 1;
  const timeouts = new Map<number, Pending>();
  const intervals = new Map<number, Pending>();
  const timers: SchedulerTimers = {
    setTimeout: (callback, delayMs) => {
      const id = nextId++;
      timeouts.set(id, { id, callback, delayMs });
      return id;
    },
    clearTimeout: (id) => timeouts.delete(id as number),
    setInterval: (callback, delayMs) => {
      const id = nextId++;
      intervals.set(id, { id, callback, delayMs });
      return id;
    },
    clearInterval: (id) => intervals.delete(id as number),
  };
  const power = new EventEmitter();
  const scheduler = new CampaignScheduler({ campaign, power, now: () => clock, timers });
  const events: string[] = [];
  scheduler.on("active", (c: Campaign) => events.push(`active:${c.id}`));
  scheduler.on("inactive", (c: Campaign) => events.push(`inactive:${c.id}`));

  return {
    scheduler,
    events,
    power,
    timeouts,
    intervals,
    setClock: (value: number) => {
      clock = value;
    },
    /** Advances the clock by the pending timeout's delay and fires it. */
    fireTimeout: () => {
      assert.equal(timeouts.size, 1, "exactly one boundary timer is armed");
      const [pending] = timeouts.values();
      timeouts.delete(pending.id);
      clock += pending.delayMs;
      pending.callback();
    },
    tickClockCheck: (elapsed: number) => {
      clock += elapsed;
      for (const pending of intervals.values()) {
        pending.callback();
      }
    },
  };
}

test("before start: inactive, emits nothing, arms one timer for the start", () => {
  const h = harness(START - 5_000);
  h.scheduler.start();
  assert.deepEqual(h.events, []);
  assert.equal(h.scheduler.isActive(), false);
  assert.deepEqual([...h.timeouts.values()].map((t) => t.delayMs), [5_000]);
});

test("launch exactly at start and mid-window emits active once and targets the end", () => {
  for (const now of [START, START + 60_000]) {
    const h = harness(now);
    h.scheduler.start();
    assert.deepEqual(h.events, ["active:black-friday-2026"]);
    assert.deepEqual([...h.timeouts.values()].map((t) => t.delayMs), [END - now]);
  }
});

test("launch exactly at end or after end is inactive with no boundary timer", () => {
  for (const now of [END, END + 1]) {
    const h = harness(now);
    h.scheduler.start();
    assert.deepEqual(h.events, []);
    assert.equal(h.timeouts.size, 0);
  }
});

test("timer fires at start, re-arms for end, then emits inactive", () => {
  const h = harness(START - 1_000);
  h.scheduler.start();
  h.fireTimeout();
  assert.deepEqual(h.events, ["active:black-friday-2026"]);
  assert.deepEqual([...h.timeouts.values()].map((t) => t.delayMs), [END - START]);
  h.fireTimeout();
  assert.deepEqual(h.events, ["active:black-friday-2026", "inactive:black-friday-2026"]);
  assert.equal(h.timeouts.size, 0);
});

test("long delays are clamped to the setTimeout max and re-armed without emitting", () => {
  const launch = START - MAX_TIMER_DELAY_MS - 10_000;
  const h = harness(launch);
  h.scheduler.start();
  assert.deepEqual([...h.timeouts.values()].map((t) => t.delayMs), [MAX_TIMER_DELAY_MS]);
  h.fireTimeout();
  assert.deepEqual(h.events, []);
  assert.deepEqual([...h.timeouts.values()].map((t) => t.delayMs), [10_000]);
  h.fireTimeout();
  assert.deepEqual(h.events, ["active:black-friday-2026"]);
});

test("resume and unlock-screen recheck across a boundary", () => {
  const h = harness(START - 1_000);
  h.scheduler.start();
  // Asleep through the start; the pending timer has not fired.
  h.setClock(START + 3_600_000);
  h.power.emit("resume");
  assert.deepEqual(h.events, ["active:black-friday-2026"]);
  assert.deepEqual([...h.timeouts.values()].map((t) => t.delayMs), [END - START - 3_600_000]);
  h.power.emit("resume");
  assert.equal(h.events.length, 1, "no repeat emit without a transition");
  h.setClock(END + 1);
  h.power.emit("unlock-screen");
  assert.deepEqual(h.events, ["active:black-friday-2026", "inactive:black-friday-2026"]);
});

test("a wall-clock jump detected by the drift check triggers a recheck", () => {
  const h = harness(START - 86_400_000);
  h.scheduler.start();
  h.tickClockCheck(CLOCK_CHECK_INTERVAL_MS);
  assert.deepEqual(h.events, []);
  h.tickClockCheck(CLOCK_CHECK_INTERVAL_MS + 86_400_000);
  assert.deepEqual(h.events, ["active:black-friday-2026"]);
  h.tickClockCheck(CLOCK_CHECK_INTERVAL_MS - 7 * 86_400_000);
  assert.deepEqual(h.events, ["active:black-friday-2026", "inactive:black-friday-2026"]);
});

test("invalid config, kill switch, or disabled campaign emits nothing and arms nothing", () => {
  for (const campaign of [null, { ...sale, enabled: false }]) {
    const h = harness(START, campaign);
    h.scheduler.start();
    h.power.emit("resume");
    assert.deepEqual(h.events, []);
    assert.equal(h.timeouts.size, 0);
    assert.equal(h.intervals.size, 0);
    assert.equal(h.power.listenerCount("resume"), 0);
  }
});

test("stop clears the timers and power listeners", () => {
  const h = harness(START - 1_000);
  h.scheduler.start();
  assert.equal(h.power.listenerCount("resume"), 1);
  assert.equal(h.power.listenerCount("unlock-screen"), 1);
  h.scheduler.stop();
  assert.equal(h.timeouts.size, 0);
  assert.equal(h.intervals.size, 0);
  assert.equal(h.power.listenerCount("resume"), 0);
  assert.equal(h.power.listenerCount("unlock-screen"), 0);
  h.setClock(START);
  h.scheduler.check();
  assert.deepEqual(h.events, []);
});
