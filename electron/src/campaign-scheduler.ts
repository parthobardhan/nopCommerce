import { EventEmitter } from "node:events";
import { isCampaignActive, parseCampaignInstant, type Campaign } from "./campaign";

/** setTimeout fires immediately for delays above a signed 32-bit int. */
export const MAX_TIMER_DELAY_MS = 2 ** 31 - 1;
export const CLOCK_CHECK_INTERVAL_MS = 60_000;
/** Wall-clock drift beyond this between clock checks counts as a clock change. */
export const CLOCK_DRIFT_TOLERANCE_MS = 30_000;

export type SchedulerTimers = {
  setTimeout: (callback: () => void, delayMs: number) => unknown;
  clearTimeout: (handle: unknown) => void;
  setInterval: (callback: () => void, delayMs: number) => unknown;
  clearInterval: (handle: unknown) => void;
};

/** The subset of Electron's powerMonitor the scheduler listens to. */
export type PowerSource = {
  on(event: "resume", listener: () => void): unknown;
  on(event: "unlock-screen", listener: () => void): unknown;
  removeListener(event: "resume", listener: () => void): unknown;
  removeListener(event: "unlock-screen", listener: () => void): unknown;
};

export type CampaignSchedulerOptions = {
  /** null when promotions are off or the config failed validation. */
  campaign: Campaign | null;
  power?: PowerSource;
  now?: () => number;
  timers?: SchedulerTimers;
};

const defaultTimers: SchedulerTimers = {
  setTimeout: (callback, delayMs) => setTimeout(callback, delayMs),
  clearTimeout: (handle) => clearTimeout(handle as NodeJS.Timeout),
  setInterval: (callback, delayMs) => setInterval(callback, delayMs),
  clearInterval: (handle) => clearInterval(handle as NodeJS.Timeout),
};

/** Emits `active` and `inactive` with the campaign, only when the state changes. */
export class CampaignScheduler extends EventEmitter {
  private readonly campaign: Campaign | null;
  private readonly power?: PowerSource;
  private readonly now: () => number;
  private readonly timers: SchedulerTimers;
  private readonly recheck = () => this.check();
  private active = false;
  private started = false;
  private boundaryTimer: unknown;
  private clockTimer: unknown;
  private lastClockCheck = 0;

  constructor(options: CampaignSchedulerOptions) {
    super();
    this.campaign = options.campaign?.enabled ? options.campaign : null;
    this.power = options.power;
    this.now = options.now ?? Date.now;
    this.timers = options.timers ?? defaultTimers;
  }

  isActive(): boolean {
    return this.active;
  }

  start(): void {
    if (this.started || !this.campaign) {
      return;
    }
    this.started = true;
    this.power?.on("resume", this.recheck);
    this.power?.on("unlock-screen", this.recheck);
    this.lastClockCheck = this.now();
    this.clockTimer = this.timers.setInterval(() => this.checkClock(), CLOCK_CHECK_INTERVAL_MS);
    this.check();
  }

  stop(): void {
    if (!this.started) {
      return;
    }
    this.started = false;
    this.power?.removeListener("resume", this.recheck);
    this.power?.removeListener("unlock-screen", this.recheck);
    this.timers.clearInterval(this.clockTimer);
    this.clearBoundaryTimer();
  }

  check(): void {
    const campaign = this.campaign;
    if (!this.started || !campaign) {
      return;
    }
    const now = this.now();
    const active = isCampaignActive(campaign, now);
    this.armBoundaryTimer(campaign, now);
    if (active !== this.active) {
      this.active = active;
      this.emit(active ? "active" : "inactive", campaign);
    }
  }

  private checkClock(): void {
    const now = this.now();
    const drift = Math.abs(now - this.lastClockCheck - CLOCK_CHECK_INTERVAL_MS);
    this.lastClockCheck = now;
    if (drift > CLOCK_DRIFT_TOLERANCE_MS) {
      this.check();
    }
  }

  private armBoundaryTimer(campaign: Campaign, now: number): void {
    this.clearBoundaryTimer();
    const next = [parseCampaignInstant(campaign.startsAt), parseCampaignInstant(campaign.endsAt)].find(
      (boundary) => boundary > now,
    );
    if (next === undefined) {
      return;
    }
    this.boundaryTimer = this.timers.setTimeout(() => {
      this.boundaryTimer = undefined;
      this.check();
    }, Math.min(next - now, MAX_TIMER_DELAY_MS));
  }

  private clearBoundaryTimer(): void {
    if (this.boundaryTimer !== undefined) {
      this.timers.clearTimeout(this.boundaryTimer);
      this.boundaryTimer = undefined;
    }
  }
}
