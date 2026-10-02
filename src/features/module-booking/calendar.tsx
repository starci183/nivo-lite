"use client";

import { useMemo, useRef } from "react";
import { cn } from "@heroui/react";
import { addDays, localDate, zonedMs } from "@/lib/module-booking-availability";
import { dayText } from "@/lib/module-booking-copy";
import type { BookingView, WorkbenchData } from "@/lib/module-booking-view";
import { STATUS_STYLE, hm, minutesOfDay } from "./shared";

const PX_PER_HOUR = 56;
const ACTIVE = ["requested", "confirmed", "rescheduled"];

type Col = { readonly key: string; readonly label: string; readonly sub: string; readonly date: string; readonly resourceId: string | null };

/** Lay out overlapping blocks side by side: each block gets a lane and the number of lanes of its cluster. */
const layout = (items: ReadonlyArray<BookingView>): Map<string, { lane: number; lanes: number }> => {
  const out = new Map<string, { lane: number; lanes: number }>();
  const sorted = [...items].sort((a, b) => a.startMs - b.startMs || a.endMs - b.endMs);
  let cluster: Array<BookingView> = [];
  let clusterEnd = 0;
  const flush = () => {
    const laneEnds: Array<number> = [];
    const lanes = new Map<string, number>();
    for (const b of cluster) {
      let lane = laneEnds.findIndex((e) => e <= b.startMs);
      if (lane === -1) {
        lane = laneEnds.length;
        laneEnds.push(b.endMs);
      } else laneEnds[lane] = b.endMs;
      lanes.set(b.id, lane);
    }
    for (const b of cluster) out.set(b.id, { lane: lanes.get(b.id) ?? 0, lanes: laneEnds.length });
    cluster = [];
  };
  for (const b of sorted) {
    if (cluster.length && b.startMs >= clusterEnd) flush();
    cluster.push(b);
    clusterEnd = Math.max(clusterEnd, b.endMs);
  }
  if (cluster.length) flush();
  return out;
};

export type CalendarProps = {
  readonly data: WorkbenchData;
  readonly mode: "day" | "week";
  readonly date: string;
  readonly resourceFilter: string;
  readonly showCancelled: boolean;
  readonly onOpen: (b: BookingView) => void;
  readonly onMove: (id: string, startMs: number, resourceId: string) => void;
};

/** The calendar: day view = one column per resource, week view = one column per day. A block is draggable (snaps to the slot step); click opens the details. */
export const Calendar = ({ data, mode, date, resourceFilter, showCancelled, onOpen, onMove }: CalendarProps) => {
  const tz = data.tz;
  const grab = useRef(0);
  const step = data.model.settings.slot_step_min;
  const resources = useMemo(() => data.model.resources.filter((r) => r.active), [data.model.resources]);
  const names = new Map(data.model.resources.map((r) => [r.id, r.name]));

  const cols: Array<Col> = useMemo(() => {
    if (mode === "day") return resources.map((r) => ({ key: r.id, label: r.name, sub: r.kind, date, resourceId: r.id }));
    return Array.from({ length: 7 }, (_, i) => addDays(data.from, i)).map((d) => ({ key: d, label: dayText(d).split(",")[0], sub: `${d.slice(8, 10)}/${d.slice(5, 7)}`, date: d, resourceId: resourceFilter || null }));
  }, [mode, date, data.from, resourceFilter, resources]);

  const visible = useMemo(() => data.bookings.filter((b) => showCancelled || b.status !== "cancelled"), [data.bookings, showCancelled]);
  const inCol = (c: Col): Array<BookingView> => visible.filter((b) => localDate(b.startMs, tz) === c.date && (mode === "day" ? b.resourceId === c.resourceId : !c.resourceId || b.resourceId === c.resourceId));

  // visible hour range: opening hours of the shown resources, widened by any booking
  const range = useMemo(() => {
    let lo = 24 * 60;
    let hi = 0;
    for (const h of data.model.hours) {
      lo = Math.min(lo, minutesOfDay(h.start));
      hi = Math.max(hi, minutesOfDay(h.end));
    }
    for (const b of visible) {
      lo = Math.min(lo, minutesOfDay(hm(b.startMs, tz)));
      hi = Math.max(hi, minutesOfDay(hm(b.endMs, tz)) || 24 * 60);
    }
    if (lo >= hi) {
      lo = 8 * 60;
      hi = 20 * 60;
    }
    return { start: Math.floor(lo / 60), end: Math.min(24, Math.ceil(hi / 60)) };
  }, [data.model.hours, visible, tz]);

  const hours = Array.from({ length: range.end - range.start }, (_, i) => range.start + i);
  const height = (range.end - range.start) * PX_PER_HOUR;
  const nowDay = localDate(data.nowMs, tz);
  const nowMin = minutesOfDay(hm(data.nowMs, tz));

  const drop = (c: Col, e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    const id = e.dataTransfer.getData("text/plain");
    const b = data.bookings.find((x) => x.id === id);
    if (!b) return;
    const y = e.clientY - e.currentTarget.getBoundingClientRect().top - grab.current;
    const snapped = Math.max(0, Math.round((range.start * 60 + (y / PX_PER_HOUR) * 60) / step) * step);
    const time = `${String(Math.floor(snapped / 60)).padStart(2, "0")}:${String(snapped % 60).padStart(2, "0")}`;
    onMove(id, zonedMs(c.date, time, tz), mode === "day" ? (c.resourceId as string) : b.resourceId);
  };

  if (!cols.length) return <p className="text-sm text-muted">Chưa có người hoặc phòng nào. Vào tab Thiết lập để thêm.</p>;

  return (
    <div className="overflow-x-auto rounded-lg border border-separator bg-surface" role="region" aria-label="Lịch hẹn">
      <div className="flex min-w-[40rem]">
        <div className="sticky left-0 z-20 w-12 shrink-0 border-r border-separator bg-surface">
          <div className="h-12 border-b border-separator" />
          <div className="relative" style={{ height }}>
            {hours.map((h) => (
              <div key={h} className="absolute right-1 -translate-y-2 text-[11px] text-muted" style={{ top: (h - range.start) * PX_PER_HOUR }}>{String(h).padStart(2, "0")}:00</div>
            ))}
          </div>
        </div>
        {cols.map((c) => {
          const items = inCol(c);
          const lanes = layout(items);
          return (
            <div key={c.key} className="min-w-36 flex-1 border-r border-separator last:border-r-0">
              <div className={cn("flex h-12 flex-col justify-center border-b border-separator px-2", c.date === nowDay && mode === "week" && "bg-accent/10")}>
                <span className="truncate text-sm font-semibold">{c.label}</span>
                <span className="truncate text-xs text-muted">{c.sub}</span>
              </div>
              <div className="relative" style={{ height }} onDragOver={(e) => e.preventDefault()} onDrop={(e) => drop(c, e)}>
                {hours.map((h) => <div key={h} className="absolute inset-x-0 border-t border-separator/60" style={{ top: (h - range.start) * PX_PER_HOUR }} />)}
                {c.date === nowDay && nowMin >= range.start * 60 && nowMin <= range.end * 60 ? (
                  <div className="pointer-events-none absolute inset-x-0 z-10 border-t-2 border-danger" style={{ top: ((nowMin - range.start * 60) / 60) * PX_PER_HOUR }} />
                ) : null}
                {items.map((b) => {
                  const l = lanes.get(b.id) ?? { lane: 0, lanes: 1 };
                  const top = ((minutesOfDay(hm(b.startMs, tz)) - range.start * 60) / 60) * PX_PER_HOUR;
                  const h = Math.max(24, ((b.endMs - b.startMs) / 3_600_000) * PX_PER_HOUR - 2);
                  const movable = ACTIVE.includes(b.status);
                  return (
                    <button
                      key={b.id}
                      type="button"
                      draggable={movable}
                      onDragStart={(e) => {
                        grab.current = e.clientY - e.currentTarget.getBoundingClientRect().top;
                        e.dataTransfer.setData("text/plain", b.id);
                        e.dataTransfer.effectAllowed = "move";
                      }}
                      onClick={() => onOpen(b)}
                      className={cn("absolute overflow-hidden rounded-md border-l-4 px-1.5 py-0.5 text-left text-xs shadow-sm focus-visible:outline-2 focus-visible:outline-focus", STATUS_STYLE[b.status]?.block, movable && "cursor-grab active:cursor-grabbing", !b.holds && b.status === "requested" && "border-dashed opacity-80")}
                      style={{ top, height: h, left: `calc(${(l.lane / l.lanes) * 100}% + 2px)`, width: `calc(${100 / l.lanes}% - 4px)` }}
                      aria-label={`${hm(b.startMs, tz)} ${b.customer} ${b.service}`}
                    >
                      <span className="block truncate font-semibold">{hm(b.startMs, tz)}-{hm(b.endMs, tz)} {b.customer || "Khách"}</span>
                      <span className="block truncate">{b.service}{mode === "week" ? ` · ${names.get(b.resourceId) ?? ""}` : ""}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
