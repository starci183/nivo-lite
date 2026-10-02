"use client";

import Link from "next/link";
import { useCallback, useEffect, useState, useTransition } from "react";
import { cn } from "@heroui/react";
import { Badge, Button, EmptyNotice, SurfaceCard, Tabs, Text } from "@starci/grammar/common";
import { addDays, localDate } from "@/lib/module-booking-availability";
import { STATUS_LABEL, dayText, whenText } from "@/lib/module-booking-copy";
import type { BookingView, WorkbenchData } from "@/lib/module-booking-view";
import { bookingStatusAction, cancelWaitAction, loadRange, moveBookingAction, type StatusAction } from "./actions";
import { AddBookingDialog } from "./add-form";
import { Calendar } from "./calendar";
import { SetupPanel } from "./setup";
import { CARD, CHIP, FIELD, PAGE, STATUS_STYLE, hm, vnd } from "./shared";

type TabId = "calendar" | "today" | "waitlist" | "stats" | "setup";
const TAB_IDS: ReadonlyArray<TabId> = ["calendar", "today", "waitlist", "stats", "setup"];
const isTab = (v: string | null): v is TabId => !!v && (TAB_IDS as ReadonlyArray<string>).includes(v);
const mondayOf = (d: string): string => addDays(d, -((new Date(`${d}T00:00:00Z`).getUTCDay() + 6) % 7));

const StatusChip = ({ status }: { readonly status: string }) => (
  <span className={CHIP}>
    <span className={cn("size-2 rounded-full", STATUS_STYLE[status]?.dot)} aria-hidden />
    {STATUS_LABEL[status] ?? status}
  </span>
);

/** The actions a booking offers in its current state. */
const actionsOf = (b: BookingView): Array<{ readonly id: StatusAction; readonly label: string; readonly variant: "primary" | "outline" | "danger-soft" }> => {
  if (b.status === "requested") return [{ id: "confirm", label: "Xác nhận", variant: "primary" }, { id: "cancel", label: "Từ chối", variant: "danger-soft" }];
  if (b.status === "confirmed" || b.status === "rescheduled") {
    return [
      ...(b.checkedIn ? [] : [{ id: "checkin" as const, label: "Check-in", variant: "primary" as const }]),
      { id: "done", label: "Xong", variant: b.checkedIn ? "primary" : "outline" },
      { id: "no_show", label: "Không đến", variant: "outline" },
      { id: "cancel", label: "Hủy", variant: "danger-soft" },
    ];
  }
  return [];
};

type Props = { readonly initial: WorkbenchData };

export const BookingWorkbenchView = ({ initial }: Props) => {
  const [data, setData] = useState(initial);
  const [tab, setTab] = useState<TabId>("calendar");
  const [mode, setMode] = useState<"day" | "week">("day");
  const [date, setDate] = useState(initial.today);
  const [resourceFilter, setResourceFilter] = useState("");
  const [showCancelled, setShowCancelled] = useState(false);
  const [open, setOpen] = useState<BookingView | null>(null);
  const [adding, setAdding] = useState(false);
  const [message, setMessage] = useState<{ readonly kind: "ok" | "error"; readonly text: string } | null>(null);
  const [pending, start] = useTransition();
  const tz = data.tz;

  useEffect(() => {
    const t = new URLSearchParams(window.location.search).get("tab");
    if (isTab(t)) setTab(t);
  }, []);
  const pick = (k: string) => {
    if (!isTab(k)) return;
    setTab(k);
    try {
      const url = new URL(window.location.href);
      url.searchParams.set("tab", k);
      window.history.replaceState(null, "", url);
    } catch {
      // the address bar is a convenience only
    }
  };

  const range = useCallback((anchor: string, m: "day" | "week"): { from: string; to: string } => (m === "week" ? { from: mondayOf(anchor), to: addDays(mondayOf(anchor), 6) } : { from: mondayOf(anchor), to: addDays(mondayOf(anchor), 6) }), []);
  const reload = useCallback((anchor = date, m = mode) => {
    const r = range(anchor, m);
    start(async () => {
      const res = await loadRange(r.from, r.to);
      if (res.ok) setData(res.data);
      else setMessage({ kind: "error", text: res.error });
    });
  }, [date, mode, range]);

  const goto = (anchor: string, m = mode) => {
    setDate(anchor);
    setMode(m);
    const r = range(anchor, m);
    if (anchor < data.from || anchor > data.to || r.from !== data.from) reload(anchor, m);
  };
  const step = mode === "day" ? 1 : 7;

  const move = (id: string, startMs: number, resourceId: string, force = false) => {
    start(async () => {
      const res = await moveBookingAction(id, startMs, resourceId, force);
      if (!res.ok) return setMessage({ kind: "error", text: res.error });
      if (!res.data.ok) {
        if (!force && window.confirm(`${res.data.reason ?? "Chỗ này đã có lịch khác."}\nBạn vẫn muốn xếp chồng vào đó?`)) return move(id, startMs, resourceId, true);
        return setMessage({ kind: "error", text: res.data.reason ?? "Không dời được lịch này." });
      }
      setMessage({ kind: "ok", text: `Đã dời lịch sang ${whenText(startMs, tz)}.` });
      reload();
    });
  };

  const act = (b: BookingView, a: StatusAction) => {
    if (a === "cancel" && !window.confirm(`Hủy lịch của ${b.customer || "khách"}?`)) return;
    start(async () => {
      const res = await bookingStatusAction(b.id, a);
      setMessage(res.ok ? { kind: "ok", text: res.data.message } : { kind: "error", text: res.error });
      setOpen(null);
      reload();
    });
  };

  const names = new Map(data.model.resources.map((r) => [r.id, r.name]));
  const todayRows = data.bookings.filter((b) => localDate(b.startMs, tz) === data.today && b.status !== "cancelled");
  const needs = data.bookings.filter((b) => b.status === "requested").length;
  const count = (n: number) => (n > 0 ? ` (${n})` : "");

  const BookingRowItem = ({ b, withActions }: { readonly b: BookingView; readonly withActions: boolean }) => (
    <li className="flex flex-col gap-2 border-b border-separator px-3 py-3 last:border-b-0 md:flex-row md:items-center md:justify-between">
      <button type="button" className="flex min-w-0 flex-1 flex-col gap-1 text-left" onClick={() => setOpen(b)}>
        <span className="flex flex-wrap items-center gap-2">
          <span className="font-semibold">{hm(b.startMs, tz)}-{hm(b.endMs, tz)}</span>
          <StatusChip status={b.status} />
          {b.checkedIn && b.status !== "done" ? <span className={CHIP}>Đã đến</span> : null}
          {!b.holds && b.status === "requested" ? <Badge tone="warning">Trùng lịch, chờ chủ quyết</Badge> : null}
        </span>
        <span className="truncate text-sm">{b.customer || "Khách"}{b.phone ? ` · ${b.phone}` : ""} · {b.service}</span>
        <span className="truncate text-xs text-muted">{names.get(b.resourceId)}{b.party > 1 ? ` · ${b.party} khách` : ""}{b.priceVnd ? ` · ${vnd(b.priceVnd)}` : ""}</span>
      </button>
      {withActions ? (
        <div className="flex flex-wrap gap-2">
          {actionsOf(b).filter((a) => a.id !== "cancel").map((a) => (
            <Button key={a.id} size="sm" variant={a.variant} isDisabled={pending} onPress={() => act(b, a.id)}>{a.label}</Button>
          ))}
        </div>
      ) : null}
    </li>
  );

  // Agenda for phones: the same bookings as a list grouped by day.
  const agendaDays = [...new Set(data.bookings.filter((b) => showCancelled || b.status !== "cancelled").map((b) => localDate(b.startMs, tz)))].sort();

  return (
    <div className={PAGE}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="primary" size="sm" onPress={() => setAdding(true)}>Thêm lịch hẹn</Button>
          {data.waitingDecisions > 0 ? <Link href="/decisions" className="text-sm font-medium text-accent underline">Có {data.waitingDecisions} việc đặt lịch đang chờ bạn quyết</Link> : null}
        </div>
        <div className="flex flex-wrap gap-3 text-xs text-muted" aria-label="Chú giải màu">
          {Object.keys(STATUS_LABEL).map((s) => <StatusChip key={s} status={s} />)}
        </div>
      </div>

      {message ? (
        <div role="status" className={cn("rounded-lg border px-3 py-2 text-sm", message.kind === "ok" ? "border-success text-success" : "border-danger text-danger")}>{message.text}</div>
      ) : null}

      <div className="max-w-full overflow-x-auto">
        <Tabs
          label="Đặt lịch hẹn"
          selectedKey={tab}
          inset="none"
          labelVisibility="always"
          panelId={(k: string) => `booking-panel-${k}`}
          onSelect={pick}
          items={[
            { id: "calendar", label: `Lịch${count(needs)}` },
            { id: "today", label: `Hôm nay${count(todayRows.length)}` },
            { id: "waitlist", label: `Danh sách chờ${count(data.waitlist.filter((w) => w.status === "waiting").length)}` },
            { id: "stats", label: "Thống kê" },
            { id: "setup", label: "Thiết lập" },
          ]}
        />
      </div>

      {tab === "calendar" ? (
        <div className="flex flex-col gap-3">
          <div className="flex flex-wrap items-center gap-2">
            <Button size="sm" variant="outline" isDisabled={pending} onPress={() => goto(addDays(date, -step))}>Trước</Button>
            <Button size="sm" variant="outline" isDisabled={pending} onPress={() => goto(data.today)}>Hôm nay</Button>
            <Button size="sm" variant="outline" isDisabled={pending} onPress={() => goto(addDays(date, step))}>Sau</Button>
            <input type="date" className={cn(FIELD, "w-40")} value={date} onChange={(e) => e.target.value && goto(e.target.value)} aria-label="Chọn ngày" />
            <div className="hidden gap-1 md:flex" role="group" aria-label="Kiểu xem">
              <Button size="sm" variant={mode === "day" ? "primary" : "outline"} onPress={() => goto(date, "day")}>Ngày</Button>
              <Button size="sm" variant={mode === "week" ? "primary" : "outline"} onPress={() => goto(date, "week")}>Tuần</Button>
            </div>
            {mode === "week" ? (
              <select className={cn(FIELD, "hidden w-44 md:block")} value={resourceFilter} onChange={(e) => setResourceFilter(e.target.value)} aria-label="Lọc theo người hoặc phòng">
                <option value="">Tất cả người và phòng</option>
                {data.model.resources.filter((r) => r.active).map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
              </select>
            ) : null}
            <label className="flex items-center gap-1.5 text-xs text-muted"><input type="checkbox" checked={showCancelled} onChange={(e) => setShowCancelled(e.target.checked)} />Hiện lịch đã hủy</label>
            <Text as="span" size="sm" tone="muted">{mode === "day" ? dayText(date) : `${dayText(data.from)} - ${dayText(data.to)}`}{pending ? " · đang tải..." : ""}</Text>
          </div>
          <div className="hidden md:block">
            <Calendar data={data} mode={mode} date={date} resourceFilter={resourceFilter} showCancelled={showCancelled} onOpen={setOpen} onMove={move} />
            <p className="mt-2 text-xs text-muted">Kéo một lịch sang giờ hoặc cột khác để dời. Bấm vào lịch để xem chi tiết.</p>
          </div>
          <div className="md:hidden">
            {agendaDays.length === 0 ? <EmptyNotice message="Tuần này chưa có lịch hẹn" description="Bấm Thêm lịch hẹn để tạo lịch đầu tiên." /> : agendaDays.map((d) => (
              <section key={d} className="mb-3">
                <h3 className="mb-1 text-sm font-semibold">{dayText(d)}</h3>
                <ul className={cn(CARD, "m-0 list-none p-0")}>
                  {data.bookings.filter((b) => localDate(b.startMs, tz) === d && (showCancelled || b.status !== "cancelled")).map((b) => <BookingRowItem key={b.id} b={b} withActions={false} />)}
                </ul>
              </section>
            ))}
          </div>
        </div>
      ) : null}

      {tab === "today" ? (
        <SurfaceCard ariaLabel="Lịch hôm nay">
          <div className="mb-2 flex items-center justify-between">
            <Text size="sm" weight="semibold">Hôm nay · {dayText(data.today)}</Text>
            <Text size="xs" tone="muted">{todayRows.length} lịch</Text>
          </div>
          {todayRows.length === 0 ? <EmptyNotice message="Hôm nay chưa có lịch hẹn" description="Lịch khách đặt qua chat hoặc trang đặt lịch sẽ hiện ở đây." /> : (
            <ul className="m-0 list-none p-0">{todayRows.map((b) => <BookingRowItem key={b.id} b={b} withActions />)}</ul>
          )}
        </SurfaceCard>
      ) : null}

      {tab === "waitlist" ? (
        <SurfaceCard ariaLabel="Danh sách chờ">
          {data.waitlist.length === 0 ? <EmptyNotice message="Chưa có khách nào trong danh sách chờ" description="Khi khách muốn được báo lúc có chỗ trống, họ sẽ nằm ở đây. Bật thẻ Báo chỗ trống trong Tự động hoá để NIVO nhắn khách." /> : (
            <ul className="m-0 list-none p-0">
              {data.waitlist.map((w) => (
                <li key={w.id} className="flex flex-col gap-1 border-b border-separator px-3 py-3 last:border-b-0 md:flex-row md:items-center md:justify-between">
                  <div className="flex min-w-0 flex-col">
                    <span className="font-semibold">{w.customer || "Khách"}{w.phone ? ` · ${w.phone}` : ""}</span>
                    <span className="text-sm text-muted">{w.service} · {whenText(w.fromMs, tz)} đến {hm(w.toMs, tz)} · {w.party} khách · {w.status === "notified" ? "đã báo" : "đang chờ"}</span>
                  </div>
                  <Button size="sm" variant="outline" isDisabled={pending} onPress={() => start(async () => { await cancelWaitAction(w.id); reload(); })}>Bỏ khỏi danh sách</Button>
                </li>
              ))}
            </ul>
          )}
        </SurfaceCard>
      ) : null}

      {tab === "stats" ? (
        <div className="flex flex-col gap-3">
          <p className="text-sm text-muted">Số liệu của tuần {dayText(data.from)} - {dayText(data.to)}.</p>
          <div className="grid grid-cols-2 gap-2 lg:grid-cols-4">
            {[
              ["Tổng lịch hẹn", String(data.stats.total)],
              ["Đã xong", String(data.stats.byStatus.done ?? 0)],
              ["Khách không đến", `${data.stats.byStatus.no_show ?? 0} (${data.stats.noShowPct}%)`],
              ["Doanh thu lịch đã xong", vnd(data.stats.doneRevenueVnd) || "0 ₫"],
            ].map(([k, v]) => (
              <div key={k} className="flex min-h-24 flex-col justify-between rounded-lg border border-separator bg-surface p-3">
                <span className="text-xs font-medium text-muted">{k}</span>
                <span className="text-2xl font-semibold">{v}</span>
              </div>
            ))}
          </div>
          <SurfaceCard ariaLabel="Công suất sử dụng">
            <Text size="sm" weight="semibold">Công suất sử dụng (giờ đã đặt trên giờ làm việc)</Text>
            <ul className="m-0 mt-3 flex list-none flex-col gap-3 p-0">
              {data.stats.byResource.length === 0 ? <li className="text-sm text-muted">Chưa có người hoặc phòng nào.</li> : data.stats.byResource.map((r) => (
                <li key={r.resourceId} className="flex flex-col gap-1">
                  <div className="flex items-center justify-between text-sm"><span>{r.name}</span><span className="font-semibold">{r.pct}%</span></div>
                  <div className="h-2 overflow-hidden rounded-full bg-surface-secondary" role="img" aria-label={`${r.name} ${r.pct}%`}><div className="h-full rounded-full bg-accent" style={{ width: `${r.pct}%` }} /></div>
                  <span className="text-xs text-muted">{Math.round(r.bookedMin / 60 * 10) / 10} giờ đã đặt / {Math.round(r.openMin / 60 * 10) / 10} giờ làm việc</span>
                </li>
              ))}
            </ul>
          </SurfaceCard>
        </div>
      ) : null}

      {tab === "setup" ? <SetupPanel data={data} onChanged={() => reload()} /> : null}

      {open ? (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-0 md:items-center md:p-4" role="dialog" aria-modal="true" aria-label="Chi tiết lịch hẹn" onClick={() => setOpen(null)}>
          <div className="max-h-[90dvh] w-full overflow-y-auto rounded-t-2xl bg-surface p-4 shadow-xl md:max-w-md md:rounded-2xl" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <h2 className="truncate text-lg font-semibold">{open.customer || "Khách"}</h2>
                <p className="text-sm text-muted">{open.service}</p>
              </div>
              <StatusChip status={open.status} />
            </div>
            <dl className="mt-3 grid grid-cols-[7rem_1fr] gap-x-3 gap-y-1.5 text-sm">
              <dt className="text-muted">Giờ hẹn</dt><dd>{whenText(open.startMs, tz)} ({Math.round((open.endMs - open.startMs) / 60_000)} phút)</dd>
              <dt className="text-muted">Người / phòng</dt><dd>{names.get(open.resourceId)}</dd>
              <dt className="text-muted">Điện thoại</dt><dd>{open.phone || "Chưa có"}</dd>
              <dt className="text-muted">Số khách</dt><dd>{open.party}</dd>
              <dt className="text-muted">Giá</dt><dd>{open.priceVnd ? vnd(open.priceVnd) : "Chưa có"}</dd>
              {open.depositVnd > 0 ? (<><dt className="text-muted">Đặt cọc</dt><dd>{vnd(open.depositVnd)} ({open.depositStatus === "paid" ? "đã nhận" : "chưa nhận"})</dd></>) : null}
              {open.feeVnd > 0 ? (<><dt className="text-muted">Phí</dt><dd>{vnd(open.feeVnd)}</dd></>) : null}
              <dt className="text-muted">Nguồn</dt><dd>{open.source}</dd>
              {open.reschedules > 0 ? (<><dt className="text-muted">Đã đổi lịch</dt><dd>{open.reschedules} lần</dd></>) : null}
              {open.note ? (<><dt className="text-muted">Ghi chú</dt><dd>{open.note}</dd></>) : null}
              {open.conflictNote ? (<><dt className="text-muted">Lưu ý</dt><dd>{open.conflictNote}</dd></>) : null}
            </dl>
            <div className="mt-4 flex flex-wrap gap-2">
              {actionsOf(open).map((a) => <Button key={a.id} size="sm" variant={a.variant} isDisabled={pending} onPress={() => act(open, a.id)}>{a.label}</Button>)}
              {open.leadId ? <Link href={`/leads/${open.leadId}`} className="inline-flex h-8 items-center px-2 text-sm text-accent underline">Xem khách</Link> : null}
              <Button size="sm" variant="outline" onPress={() => setOpen(null)}>Đóng</Button>
            </div>
          </div>
        </div>
      ) : null}

      {adding ? <AddBookingDialog data={data} defaultDate={date} onClose={() => setAdding(false)} onAdded={() => { setAdding(false); setMessage({ kind: "ok", text: "Đã thêm lịch hẹn." }); reload(); }} /> : null}
    </div>
  );
};
