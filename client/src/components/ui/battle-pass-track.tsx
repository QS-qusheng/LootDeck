"use client";

/*
 * BattlePassTrack — vendored from bigbullui (MIT License, © 2026 F0Rextasy).
 * Source: registry item "battle-pass-track" (ui.bigbullapp.com/r/battle-pass-track.json),
 * fetched verbatim; structure, segment rail, XP fill and transition logic are the
 * original component's. Only two adaptations were made, per house rules:
 *   1. Data/labels: header shows our pool progress (Lv.{tier} · 已点亮 tier/total,
 *      next 5-step milestone on the right) instead of the demo "Pass / Tier" text.
 *   2. Colors: shadcn token classes swapped for this page's QShip tokens
 *      (surface/border/progress-bg vars + the .qs-bp-* gold-gradient classes).
 */

import * as React from "react";
import { cn } from "./lib/utils";

export interface BattlePassTrackProps extends React.HTMLAttributes<HTMLDivElement> {
  tier?: number;
  total?: number;
  xp?: number;
  xpMax?: number;
}

/** Battle pass track: tier rail with progress fill. */
export function BattlePassTrack({ tier = 7, total = 20, xp = 640, xpMax = 1000, className, ...props }: BattlePassTrackProps) {
  const pct = Math.max(0, Math.min(100, (xp / Math.max(1, xpMax)) * 100));
  const nextMilestone =
    tier < total ? Math.min(total, (Math.floor(tier / 5) + 1) * 5) : null;
  return (
    <div
      role="progressbar"
      aria-valuemin={0}
      aria-valuemax={xpMax}
      aria-valuenow={xp}
      aria-label={`点亮进度 ${tier}/${total}`}
      className={cn("w-full touch-none select-none rounded-md border-2 border-[var(--border)] bg-[var(--surface)] p-2.5", className)}
      style={{ touchAction: "none" }}
      {...props}
    >
      <div className="flex items-center justify-between font-mono text-[10px] font-bold uppercase tracking-[0.2em]">
        <span className="flex items-baseline gap-2">
          <span className="text-sm normal-case tracking-normal text-[var(--gold-text)]">Lv.{tier}</span>
          <span className="text-[var(--dim)]">已点亮 {tier}/{total}</span>
        </span>
        <span className="tabular-nums text-[var(--text)]">
          {nextMilestone != null ? `下一格 · ${nextMilestone} 家` : "已满格"}
        </span>
      </div>
      <div className="mt-2 flex gap-1" aria-hidden="true">
        {Array.from({ length: total }).map((_, i) => (
          <span key={i} className={cn("h-11 min-w-0 flex-1 rounded-[2px]", i < tier ? "qs-bp-seg-on" : "bg-[var(--progress-bg)]")} />
        ))}
      </div>
      <div className="mt-2 h-2 overflow-hidden rounded-full bg-[var(--progress-bg)]" aria-hidden="true">
        <div className="qs-bp-fill h-full transition-[width] duration-500 motion-reduce:transition-none" style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}
