import { cn } from "@heroui/react";
import { localHhmm } from "@/lib/module-booking-availability";

/** Colour per status (one place): the calendar block, the agenda dot and the legend all read it. */
export const STATUS_STYLE: Readonly<Record<string, { readonly block: string; readonly dot: string }>> = {
  requested: { block: "border-amber-500 bg-amber-100 text-amber-950 dark:bg-amber-500/25 dark:text-amber-50", dot: "bg-amber-500" },
  confirmed: { block: "border-sky-500 bg-sky-100 text-sky-950 dark:bg-sky-500/25 dark:text-sky-50", dot: "bg-sky-500" },
  rescheduled: { block: "border-violet-500 bg-violet-100 text-violet-950 dark:bg-violet-500/25 dark:text-violet-50", dot: "bg-violet-500" },
  done: { block: "border-emerald-500 bg-emerald-100 text-emerald-950 dark:bg-emerald-500/25 dark:text-emerald-50", dot: "bg-emerald-500" },
  no_show: { block: "border-rose-500 bg-rose-100 text-rose-950 dark:bg-rose-500/25 dark:text-rose-50", dot: "bg-rose-500" },
  cancelled: { block: "border-zinc-400 bg-zinc-100 text-zinc-600 line-through dark:bg-zinc-500/20 dark:text-zinc-300", dot: "bg-zinc-400" },
};

export const PAGE = cn("flex", "min-w-0", "flex-col", "gap-4", "py-2", "md:py-4");
export const CARD = cn("rounded-lg", "border", "border-separator", "bg-surface", "p-3", "md:p-4");
export const FIELD = cn("h-10", "w-full", "min-w-0", "rounded-lg", "border", "border-separator", "bg-surface", "px-3", "text-sm", "text-foreground", "focus-visible:outline-2", "focus-visible:outline-focus");
export const LABEL = cn("flex", "min-w-0", "flex-col", "gap-1", "text-xs", "font-medium", "text-muted");
export const GRID2 = cn("grid", "grid-cols-1", "gap-3", "sm:grid-cols-2", "lg:grid-cols-3");
export const CHIP = cn("inline-flex", "items-center", "gap-1.5", "rounded-full", "border", "border-separator", "px-2.5", "py-0.5", "text-xs");

export const hm = (ms: number, tz: string): string => localHhmm(ms, tz);
export const minutesOfDay = (hhmm: string): number => Number(hhmm.slice(0, 2)) * 60 + Number(hhmm.slice(3, 5));
export const vnd = (n: number | null | undefined): string => (n === null || n === undefined ? "" : `${new Intl.NumberFormat("vi-VN").format(n)} ₫`);
export const WEEKDAY_SHORT = ["", "T2", "T3", "T4", "T5", "T6", "T7", "CN"] as const;
