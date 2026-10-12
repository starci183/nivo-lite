"use client";

import { useCallback, useState, useTransition, type ReactNode } from "react";
import { parseDate } from "@internationalized/date";
import {
  Alert, AlertDialog, Badge, Button, Checkbox, DateField, DescriptionList, Dialog, EmptyNotice, Meter, SegmentedControl, Select,
  SurfaceCard, SurfaceListCard, Text, TextAction, type DescriptionListItem,
} from "@starci/grammar/common";
import { AgentDashboardFrame } from "@/features/agent-dashboard";
import { useT } from "@/i18n/client";
import { workbenchBooking } from "@/i18n/dict/workbenchBooking";
import type { AgentDashboardData } from "@/lib/agent-dashboard-shared";
import { addDays, localDate } from "@/lib/module-booking-availability";
import { STATUS_LABEL, dayText, whenText } from "@/lib/module-booking-copy";
import type { BookingView, WorkbenchData } from "@/lib/module-booking-view";
import type { BookingFigures } from "@/lib/workbench-booking";
import { bookingStatusAction, cancelWaitAction, loadRange, moveBookingAction, type StatusAction } from "./actions";
import { AddBookingDialog } from "./add-form";
import { Calendar } from "./calendar";
import { SetupPanel } from "./setup";
import { LIST_ROW, LIST_ROW_MAIN, METER_ROW, PHONE_ONLY, ROW, ROW_SPREAD, STACK, STATUS_TONE, WIDE_ONLY, WIDE_ONLY_BLOCK, hm, vnd } from "./shared";

const mondayOf = (d: string): string => addDays(d, -((new Date(`${d}T00:00:00Z`).getUTCDay() + 6) % 7));

/** Select id for "every resource" (a list key cannot be empty). */
const ALL_RESOURCES = "all";

const StatusBadge = ({ status }: { readonly status: string }) => <Badge tone={STATUS_TONE[status] ?? "neutral"} isDot>{STATUS_LABEL[status] ?? status}</Badge>;

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

type Props = {
  readonly initial: WorkbenchData;
  /** The four ribbon figures; null when they could not be read (the ribbon fails in place). */
  readonly figures: BookingFigures | null;
  /** The frame's common regions (waiting, done, connections, knowledge), loaded on the server. */
  readonly dashboard: AgentDashboardData;
  /** `?tab=` of the route, read on the server. */
  readonly initialTab: string | null;
};
type StackRequest = { readonly id: string; readonly startMs: number; readonly resourceId: string; readonly reason: string };

/** The Booking workbench: the agent dashboard frame (four figures, waiting, done, connections, knowledge) around the calendar, today, waitlist, statistics and setup as tabs. */
export const BookingWorkbenchView = ({ initial, figures, dashboard, initialTab }: Props) => {
  const t = useT(workbenchBooking);
  const [data, setData] = useState(initial);
  const [mode, setMode] = useState<"day" | "week">("day");
  const [date, setDate] = useState(initial.today);
  const [resourceFilter, setResourceFilter] = useState("");
  const [showCancelled, setShowCancelled] = useState(false);
  const [open, setOpen] = useState<BookingView | null>(null);
  const [adding, setAdding] = useState(false);
  const [message, setMessage] = useState<{ readonly kind: "ok" | "error"; readonly text: string } | null>(null);
  const [confirmCancel, setConfirmCancel] = useState<BookingView | null>(null);
  const [confirmStack, setConfirmStack] = useState<StackRequest | null>(null);
  const [pending, start] = useTransition();
  const tz = data.tz;

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
        if (!force) return setConfirmStack({ id, startMs, resourceId, reason: res.data.reason ?? "Chỗ này đã có lịch khác." });
        return setMessage({ kind: "error", text: res.data.reason ?? "Không dời được lịch này." });
      }
      setMessage({ kind: "ok", text: `Đã dời lịch sang ${whenText(startMs, tz)}.` });
      reload();
    });
  };

  const act = (b: BookingView, a: StatusAction, confirmed = false) => {
    if (a === "cancel" && !confirmed) return setConfirmCancel(b);
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
    <li className={LIST_ROW}>
      <div className={LIST_ROW_MAIN}>
        <div className={ROW}>
          <TextAction onPress={() => setOpen(b)}>{`${hm(b.startMs, tz)}-${hm(b.endMs, tz)}`}</TextAction>
          <StatusBadge status={b.status} />
          {b.checkedIn && b.status !== "done" ? <Badge tone="neutral">Đã đến</Badge> : null}
          {!b.holds && b.status === "requested" ? <Badge tone="warning">Trùng lịch, chờ chủ quyết</Badge> : null}
        </div>
        <Text size="sm" overflow="truncate">{`${b.customer || "Khách"}${b.phone ? ` · ${b.phone}` : ""} · ${b.service}`}</Text>
        <Text size="xs" tone="muted" overflow="truncate">{`${names.get(b.resourceId) ?? ""}${b.party > 1 ? ` · ${b.party} khách` : ""}${b.priceVnd ? ` · ${vnd(b.priceVnd)}` : ""}`}</Text>
      </div>
      {withActions ? (
        <div className={ROW}>
          {actionsOf(b).filter((a) => a.id !== "cancel").map((a) => (
            <Button key={a.id} size="sm" variant={a.variant} isDisabled={pending} onPress={() => act(b, a.id)}>{a.label}</Button>
          ))}
        </div>
      ) : null}
    </li>
  );

  const detailItems = (b: BookingView): ReadonlyArray<DescriptionListItem> => [
    { id: "when", term: "Giờ hẹn", description: `${whenText(b.startMs, tz)} (${Math.round((b.endMs - b.startMs) / 60_000)} phút)` },
    { id: "resource", term: "Người / phòng", description: names.get(b.resourceId) ?? "" },
    { id: "phone", term: "Điện thoại", description: b.phone || "Chưa có" },
    { id: "party", term: "Số khách", description: String(b.party) },
    { id: "price", term: "Giá", description: b.priceVnd ? vnd(b.priceVnd) : "Chưa có" },
    ...(b.depositVnd > 0 ? [{ id: "deposit", term: "Đặt cọc", description: `${vnd(b.depositVnd)} (${b.depositStatus === "paid" ? "đã nhận" : "chưa nhận"})` }] : []),
    ...(b.feeVnd > 0 ? [{ id: "fee", term: "Phí", description: vnd(b.feeVnd) }] : []),
    { id: "source", term: "Nguồn", description: b.source },
    ...(b.reschedules > 0 ? [{ id: "reschedules", term: "Đã đổi lịch", description: `${b.reschedules} lần` }] : []),
    ...(b.note ? [{ id: "note", term: "Ghi chú", description: b.note }] : []),
    ...(b.conflictNote ? [{ id: "conflict", term: "Lưu ý", description: b.conflictNote }] : []),
  ];

  // Agenda for phones: the same bookings as a list grouped by day.
  const agendaDays = [...new Set(data.bookings.filter((b) => showCancelled || b.status !== "cancelled").map((b) => localDate(b.startMs, tz)))].sort();

  // Page command of the booking views: the add button beside the colour legend (the frame's own primary stays "Talk to the agent").
  const toolbar = (
    <div className={ROW_SPREAD}>
      <Button variant="outline" size="sm" onPress={() => setAdding(true)}>{t("addBooking")}</Button>
      <div className={ROW} role="group" aria-label="Chú giải màu">
        {Object.keys(STATUS_LABEL).map((s) => <StatusBadge key={s} status={s} />)}
      </div>
    </div>
  );

  // Feedback and dialogs belong to the whole workbench; only the active tab is mounted, so each tab carries them once.
  const overlays = (
    <>
      {open ? (
        <Dialog
          isOpen
          onOpenChange={(isOpen) => { if (!isOpen) setOpen(null); }}
          size="md"
          title={open.customer || "Khách"}
          description={open.service}
          closeLabel="Đóng"
          footer={
            <>
              {open.leadId ? <Button size="sm" variant="ghost" href={`/leads/${open.leadId}`}>Xem khách</Button> : null}
              <Button size="sm" variant="outline" onPress={() => setOpen(null)}>Đóng</Button>
              {actionsOf(open).map((a) => <Button key={a.id} size="sm" variant={a.variant} isDisabled={pending} onPress={() => act(open, a.id)}>{a.label}</Button>)}
            </>
          }
        >
          <div className={STACK}>
            <div className={ROW}><StatusBadge status={open.status} /></div>
            <DescriptionList layout="columns" items={detailItems(open)} />
          </div>
        </Dialog>
      ) : null}

      {confirmCancel ? (
        <AlertDialog
          isOpen
          onOpenChange={(isOpen) => { if (!isOpen) setConfirmCancel(null); }}
          tone="negative"
          title={`Hủy lịch của ${confirmCancel.customer || "khách"}?`}
          confirmLabel="Hủy lịch"
          cancelLabel="Giữ lịch"
          onConfirm={() => act(confirmCancel, "cancel", true)}
        />
      ) : null}

      {confirmStack ? (
        <AlertDialog
          isOpen
          onOpenChange={(isOpen) => { if (!isOpen) setConfirmStack(null); }}
          tone="cautionary"
          title="Bạn vẫn muốn xếp chồng vào đó?"
          description={confirmStack.reason}
          confirmLabel="Vẫn xếp chồng"
          cancelLabel="Không dời"
          onConfirm={() => move(confirmStack.id, confirmStack.startMs, confirmStack.resourceId, true)}
        />
      ) : null}

      {adding ? <AddBookingDialog data={data} defaultDate={date} onClose={() => setAdding(false)} onAdded={() => { setAdding(false); setMessage({ kind: "ok", text: "Đã thêm lịch hẹn." }); reload(); }} /> : null}
    </>
  );

  const withChrome = (content: ReactNode, withToolbar: boolean) => (
    <>
      {withToolbar ? toolbar : null}
      {message ? <Alert key={message.text} tone={message.kind === "ok" ? "affirmative" : "negative"} title={message.text} dismissLabel="Ẩn" onDismiss={() => setMessage(null)} /> : null}
      {content}
      {overlays}
    </>
  );

  const calendarTab = (
        <div className={STACK}>
          <div className={ROW}>
            <Button size="sm" variant="outline" isDisabled={pending} onPress={() => goto(addDays(date, -step))}>Trước</Button>
            <Button size="sm" variant="outline" isDisabled={pending} onPress={() => goto(data.today)}>Hôm nay</Button>
            <Button size="sm" variant="outline" isDisabled={pending} onPress={() => goto(addDays(date, step))}>Sau</Button>
            <DateField label="Chọn ngày" isLabelHidden value={parseDate(date)} onValueChange={(v) => { if (v) goto(v.toString()); }} />
            <div className={WIDE_ONLY}>
              <SegmentedControl label="Kiểu xem" isLabelHidden options={[{ value: "day", label: "Ngày" }, { value: "week", label: "Tuần" }]} value={mode} onValueChange={(v) => goto(date, v === "week" ? "week" : "day")} />
            </div>
            {mode === "week" ? (
              <div className={WIDE_ONLY}>
                <Select
                  label="Lọc theo người hoặc phòng"
                  isLabelHidden
                  options={[{ id: ALL_RESOURCES, label: "Tất cả người và phòng" }, ...data.model.resources.filter((r) => r.active).map((r) => ({ id: r.id, label: r.name }))]}
                  value={resourceFilter || ALL_RESOURCES}
                  onValueChange={(v) => setResourceFilter(!v || v === ALL_RESOURCES ? "" : v)}
                />
              </div>
            ) : null}
            <Checkbox label="Hiện lịch đã hủy" isSelected={showCancelled} onSelectedChange={setShowCancelled} />
            <Text as="span" size="sm" tone="muted">{`${mode === "day" ? dayText(date) : `${dayText(data.from)} - ${dayText(data.to)}`}${pending ? " · đang tải..." : ""}`}</Text>
          </div>
          <div className={WIDE_ONLY_BLOCK}>
            <Calendar data={data} mode={mode} date={date} resourceFilter={resourceFilter} showCancelled={showCancelled} onOpen={setOpen} onMove={move} />
            <Text size="xs" tone="muted">Kéo một lịch sang giờ hoặc cột khác để dời. Bấm vào lịch để xem chi tiết.</Text>
          </div>
          <div className={PHONE_ONLY}>
            {agendaDays.length === 0 ? (
              <SurfaceCard ariaLabel="Lịch hẹn">
                <EmptyNotice message="Tuần này chưa có lịch hẹn" description="Bấm Thêm lịch hẹn để tạo lịch đầu tiên." />
              </SurfaceCard>
            ) : agendaDays.map((d) => (
              <SurfaceListCard key={d} label={dayText(d)}>
                {data.bookings.filter((b) => localDate(b.startMs, tz) === d && (showCancelled || b.status !== "cancelled")).map((b) => <BookingRowItem key={b.id} b={b} withActions={false} />)}
              </SurfaceListCard>
            ))}
          </div>
        </div>
  );
  const todayTab = (
        <SurfaceListCard
          label={`Hôm nay · ${dayText(data.today)}`}
          fact={`${todayRows.length} lịch`}
          empty={<EmptyNotice message="Hôm nay chưa có lịch hẹn" description="Lịch khách đặt qua chat hoặc trang đặt lịch sẽ hiện ở đây." />}
        >
          {todayRows.map((b) => <BookingRowItem key={b.id} b={b} withActions />)}
        </SurfaceListCard>
  );
  const waitlistTab = (
        <SurfaceListCard
          ariaLabel="Danh sách chờ"
          empty={<EmptyNotice message="Chưa có khách nào trong danh sách chờ" description="Khi khách muốn được báo lúc có chỗ trống, họ sẽ nằm ở đây. Bật thẻ Báo chỗ trống trong Tự động hoá để NIVO nhắn khách." />}
        >
          {data.waitlist.map((w) => (
            <li key={w.id} className={LIST_ROW}>
              <div className={LIST_ROW_MAIN}>
                <Text weight="semibold">{`${w.customer || "Khách"}${w.phone ? ` · ${w.phone}` : ""}`}</Text>
                <Text size="sm" tone="muted">{`${w.service} · ${whenText(w.fromMs, tz)} đến ${hm(w.toMs, tz)} · ${w.party} khách · ${w.status === "notified" ? "đã báo" : "đang chờ"}`}</Text>
              </div>
              <Button size="sm" variant="outline" isDisabled={pending} onPress={() => start(async () => { await cancelWaitAction(w.id); reload(); })}>Bỏ khỏi danh sách</Button>
            </li>
          ))}
        </SurfaceListCard>
  );
  const statsTab = (
        <div className={STACK}>
          <Text size="sm" tone="muted">{`Số liệu của tuần ${dayText(data.from)} - ${dayText(data.to)}.`}</Text>
          <SurfaceCard ariaLabel="Thống kê">
            <DescriptionList
              layout="stat-strip"
              isDivided
              items={[
                { id: "total", term: "Tổng lịch hẹn", description: String(data.stats.total) },
                { id: "done", term: "Đã xong", description: String(data.stats.byStatus.done ?? 0) },
                { id: "no_show", term: "Khách không đến", description: String(data.stats.byStatus.no_show ?? 0), unit: `(${data.stats.noShowPct}%)` },
                { id: "revenue", term: "Doanh thu lịch đã xong", description: vnd(data.stats.doneRevenueVnd) || "0 ₫" },
              ]}
            />
          </SurfaceCard>
          <SurfaceListCard label="Công suất sử dụng (giờ đã đặt trên giờ làm việc)" empty={<EmptyNotice message="Chưa có người hoặc phòng nào." />}>
            {data.stats.byResource.map((r) => (
              <li key={r.resourceId} className={METER_ROW}>
                <Meter label={r.name} value={r.pct} minValue={0} maxValue={100} valueLabel={`${r.pct}%`} />
                <Text size="xs" tone="muted">{`${Math.round(r.bookedMin / 60 * 10) / 10} giờ đã đặt / ${Math.round(r.openMin / 60 * 10) / 10} giờ làm việc`}</Text>
              </li>
            ))}
          </SurfaceListCard>
        </div>
  );
  const setupTab = (
        <SetupPanel data={data} onChanged={() => reload()} />
  );


  return (
    <AgentDashboardFrame
      module="booking"
      data={dashboard}
      initialTab={initialTab}
      figuresFailed={figures === null}
      figures={figures === null ? [] : [
        { id: "today", term: t("metricToday"), description: String(figures.bookingsToday), meta: t("metricTodayBasis") },
        { id: "noShow", term: t("metricNoShow"), description: figures.noShowPct30d === null ? "—" : `${figures.noShowPct30d}%`, meta: figures.noShowPct30d === null ? t("metricNoShowNone") : t("metricNoShowBasis", { n: figures.finished30d }) },
        { id: "utilisation", term: t("metricUtilisation"), description: figures.utilisationPct === null ? "—" : `${figures.utilisationPct}%`, meta: figures.utilisationPct === null ? t("metricUtilisationNone") : t("metricUtilisationBasis") },
        { id: "deposits", term: t("metricDeposits"), description: String(figures.depositsPending), meta: figures.depositsPending === 0 ? t("metricDepositsNone") : t("metricDepositsBasis", { value: vnd(figures.depositsPendingVnd) }) },
      ]}
      tabs={[
        { id: "calendar", label: `${t("tabCalendar")}${count(needs)}`, content: withChrome(calendarTab, true) },
        { id: "today", label: `${t("tabToday")}${count(todayRows.length)}`, content: withChrome(todayTab, true) },
        { id: "waitlist", label: `${t("tabWaitlist")}${count(data.waitlist.filter((w) => w.status === "waiting").length)}`, content: withChrome(waitlistTab, false) },
        { id: "stats", label: t("tabStats"), content: withChrome(statsTab, false) },
        { id: "setup", label: t("tabSetup"), content: withChrome(setupTab, false) },
      ]}
    />
  );
};
