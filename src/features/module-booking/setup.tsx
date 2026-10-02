"use client";

import { useState, useTransition } from "react";
import { cn } from "@heroui/react";
import { Button, SurfaceCard, Text } from "@starci/grammar/common";
import type { WorkbenchData } from "@/lib/module-booking-view";
import {
  addExceptionAction, deleteExceptionAction, deleteResourceAction, deleteServiceAction, saveHoursAction, savePublicPageAction, saveResourceAction, saveServiceAction, saveSettingsAction,
} from "./actions";
import { FIELD, GRID2, LABEL, WEEKDAY_SHORT, vnd } from "./shared";

type Done = () => void;
const useRun = (onChanged: Done) => {
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const go = (fn: () => Promise<{ ok: true; data: unknown } | { ok: false; error: string }>, okText = "Đã lưu.") =>
    start(async () => {
      const r = await fn();
      setMsg(r.ok ? { ok: true, text: okText } : { ok: false, text: r.error });
      if (r.ok) onChanged();
    });
  const note = msg ? <p role={msg.ok ? "status" : "alert"} className={cn("text-sm", msg.ok ? "text-success" : "text-danger")}>{msg.text}</p> : null;
  return { pending, go, note };
};

const Section = ({ title, hint, children }: { readonly title: string; readonly hint?: string; readonly children: React.ReactNode }) => (
  <SurfaceCard ariaLabel={title}>
    <div className="flex flex-col gap-3">
      <div>
        <Text size="md" weight="semibold">{title}</Text>
        {hint ? <p className="text-sm text-muted">{hint}</p> : null}
      </div>
      {children}
    </div>
  </SurfaceCard>
);

/* ------------------------------------------------------------------ policy */

const PolicyForm = ({ data, onChanged }: { readonly data: WorkbenchData; readonly onChanged: Done }) => {
  const s = data.model.settings;
  const [f, setF] = useState({ cancelWindowHours: s.cancel_window_hours, depositPct: s.deposit_pct, lateCancelFeePct: s.late_cancel_fee_pct, noShowFeeVnd: s.no_show_fee_vnd, minLeadMin: s.min_lead_min, maxAdvanceDays: s.max_advance_days, slotStepMin: s.slot_step_min, autoConfirm: s.auto_confirm, handoffOrder: s.handoff_order, address: s.address, timezone: s.timezone });
  const { pending, go, note } = useRun(onChanged);
  const n = (k: keyof typeof f, label: string, hint?: string) => (
    <label className={LABEL}>{label}
      <input className={FIELD} type="number" min={0} value={f[k] as number} onChange={(e) => setF({ ...f, [k]: Number(e.target.value) || 0 })} />
      {hint ? <span className="font-normal">{hint}</span> : null}
    </label>
  );
  return (
    <Section title="Chính sách đặt lịch" hint="Khách đổi hoặc hủy trong khung giờ này thì NIVO hỏi bạn trước. Phí hủy chỉ được ghi sau khi bạn đồng ý.">
      <form className="flex flex-col gap-3" onSubmit={(e) => { e.preventDefault(); go(() => saveSettingsAction(f)); }}>
        <div className={GRID2}>
          {n("cancelWindowHours", "Đổi hoặc hủy miễn phí trước (giờ)")}
          {n("lateCancelFeePct", "Phí hủy sát giờ (% giá dịch vụ)")}
          {n("noShowFeeVnd", "Phí khách không đến (₫)")}
          {n("depositPct", "Đặt cọc (% giá dịch vụ)")}
          {n("minLeadMin", "Đặt trước tối thiểu (phút)")}
          {n("maxAdvanceDays", "Cho đặt trước tối đa (ngày)")}
          {n("slotStepMin", "Bước giờ hẹn (phút)")}
          <label className={cn(LABEL, "sm:col-span-2")}>Địa chỉ gửi cho khách<input className={FIELD} value={f.address} onChange={(e) => setF({ ...f, address: e.target.value })} /></label>
        </div>
        <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={f.autoConfirm} onChange={(e) => setF({ ...f, autoConfirm: e.target.checked })} />Chỗ trống trong chính sách thì tự xác nhận (nếu tắt, mọi yêu cầu đều chờ bạn duyệt)</label>
        <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={f.handoffOrder} onChange={(e) => setF({ ...f, handoffOrder: e.target.checked })} />Lịch xong có giá thì chuyển cho Bán hàng thành đơn hàng</label>
        <div className="flex items-center gap-3"><Button type="submit" variant="primary" size="sm" isPending={pending}>Lưu chính sách</Button>{note}</div>
      </form>
    </Section>
  );
};

/* ------------------------------------------------------------------ public page */

const PublicForm = ({ data, onChanged }: { readonly data: WorkbenchData; readonly onChanged: Done }) => {
  const s = data.model.settings;
  const [enabled, setEnabled] = useState(s.public_enabled);
  const [slug, setSlug] = useState(s.public_slug ?? "");
  const [noteText, setNoteText] = useState(s.public_note);
  const { pending, go, note } = useRun(onChanged);
  return (
    <Section title="Trang đặt lịch cho khách" hint="Khách mở đường dẫn này, chọn dịch vụ, giờ và để lại tên và số điện thoại. Không cần đăng nhập. Lịch trong chính sách được xác nhận tự động.">
      <form className="flex flex-col gap-3" onSubmit={(e) => { e.preventDefault(); go(() => savePublicPageAction({ enabled, slug, note: noteText })); }}>
        <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={enabled} onChange={(e) => setEnabled(e.target.checked)} />Bật trang đặt lịch</label>
        <div className={GRID2}>
          <label className={LABEL}>Địa chỉ (/b/...)<input className={FIELD} value={slug} onChange={(e) => setSlug(e.target.value)} placeholder="ten-cua-hang" /></label>
          <label className={cn(LABEL, "sm:col-span-2")}>Lời nhắn trên trang<input className={FIELD} value={noteText} onChange={(e) => setNoteText(e.target.value)} placeholder="Ví dụ: Mang theo thẻ bảo hành" /></label>
        </div>
        {s.public_slug && s.public_enabled ? <p className="text-sm">Đường dẫn của bạn: <a className="text-accent underline" href={`/b/${s.public_slug}`} target="_blank" rel="noreferrer">/b/{s.public_slug}</a></p> : null}
        <div className="flex items-center gap-3"><Button type="submit" variant="primary" size="sm" isPending={pending}>Lưu</Button>{note}</div>
      </form>
    </Section>
  );
};

/* ------------------------------------------------------------------ services */

type SvcDraft = { id?: string; name: string; durationMin: number; bufferMin: number; price: string; resourceKind: string; followupDays: string; active: boolean; description: string };
const emptySvc: SvcDraft = { name: "", durationMin: 30, bufferMin: 0, price: "", resourceKind: "", followupDays: "", active: true, description: "" };

const ServiceRow = ({ d, kinds, onChanged, startOpen = false }: { readonly d: SvcDraft; readonly kinds: ReadonlyArray<string>; readonly onChanged: Done; readonly startOpen?: boolean }) => {
  const [f, setF] = useState(d);
  const [open, setOpen] = useState(startOpen);
  const { pending, go, note } = useRun(() => { onChanged(); if (!d.id) { setF(emptySvc); } });
  return (
    <li className="border-b border-separator py-3 last:border-b-0">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <button type="button" className="min-w-0 text-left" onClick={() => setOpen((v) => !v)} aria-expanded={open}>
          <span className="font-semibold">{d.id ? d.name : "Thêm dịch vụ"}</span>
          {d.id ? <span className="text-sm text-muted"> · {d.durationMin} phút{d.bufferMin ? ` + nghỉ ${d.bufferMin}` : ""}{d.price ? ` · ${vnd(Number(d.price))}` : ""}{d.resourceKind ? ` · cần ${d.resourceKind}` : ""}{d.active ? "" : " · đang tạm ngưng"}</span> : null}
        </button>
        <Button size="sm" variant="outline" onPress={() => setOpen((v) => !v)}>{open ? "Thu gọn" : d.id ? "Sửa" : "Mở form"}</Button>
      </div>
      {open ? (
        <form className="mt-3 flex flex-col gap-3" onSubmit={(e) => { e.preventDefault(); go(() => saveServiceAction({ id: f.id, name: f.name, durationMin: f.durationMin, bufferMin: f.bufferMin, priceVnd: f.price.trim() ? Number(f.price.replace(/[^\d]/g, "")) : null, resourceKind: f.resourceKind, followupDays: f.followupDays ? Number(f.followupDays) : null, active: f.active, description: f.description })); }}>
          <div className={GRID2}>
            <label className={LABEL}>Tên dịch vụ<input className={FIELD} value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} required /></label>
            <label className={LABEL}>Thời lượng (phút)<input className={FIELD} type="number" min={5} value={f.durationMin} onChange={(e) => setF({ ...f, durationMin: Number(e.target.value) || 30 })} /></label>
            <label className={LABEL}>Nghỉ sau buổi hẹn (phút)<input className={FIELD} type="number" min={0} value={f.bufferMin} onChange={(e) => setF({ ...f, bufferMin: Number(e.target.value) || 0 })} /></label>
            <label className={LABEL}>Giá (₫)<input className={FIELD} inputMode="numeric" value={f.price} onChange={(e) => setF({ ...f, price: e.target.value })} placeholder="Để trống nếu chưa có giá" /></label>
            <label className={LABEL}>Loại người/phòng cần<input className={FIELD} list="booking-kinds" value={f.resourceKind} onChange={(e) => setF({ ...f, resourceKind: e.target.value })} placeholder="Để trống = bất kỳ" /></label>
            <label className={LABEL}>Mời quay lại sau (ngày)<input className={FIELD} type="number" min={1} value={f.followupDays} onChange={(e) => setF({ ...f, followupDays: e.target.value })} placeholder="Để trống = không mời" /></label>
            <label className={cn(LABEL, "sm:col-span-2 lg:col-span-3")}>Mô tả ngắn<input className={FIELD} value={f.description} onChange={(e) => setF({ ...f, description: e.target.value })} /></label>
          </div>
          <datalist id="booking-kinds">{kinds.map((k) => <option key={k} value={k} />)}</datalist>
          <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={f.active} onChange={(e) => setF({ ...f, active: e.target.checked })} />Đang nhận đặt</label>
          <div className="flex flex-wrap items-center gap-2">
            <Button type="submit" size="sm" variant="primary" isPending={pending}>{d.id ? "Lưu dịch vụ" : "Thêm dịch vụ"}</Button>
            {d.id ? <Button size="sm" variant="danger-soft" isDisabled={pending} onPress={() => { if (window.confirm(`Xóa dịch vụ "${d.name}"? Nếu đã có lịch hẹn, dịch vụ chỉ bị ngưng nhận đặt.`)) go(() => deleteServiceAction(d.id as string), "Đã xóa."); }}>Xóa</Button> : null}
            {note}
          </div>
        </form>
      ) : null}
    </li>
  );
};

/* ------------------------------------------------------------------ resources and weekly hours */

const dayLine = (hours: WorkbenchData["model"]["hours"], resourceId: string, weekday: number): string =>
  hours.filter((h) => h.resourceId === resourceId && h.weekday === weekday).sort((a, b) => a.start.localeCompare(b.start)).map((h) => `${h.start}-${h.end}`).join(", ");

const parseLine = (line: string): Array<{ start: string; end: string }> | null => {
  const t = line.trim();
  if (!t || /^(nghỉ|nghi|off)$/i.test(t)) return [];
  const out: Array<{ start: string; end: string }> = [];
  for (const part of t.split(/[,;]/)) {
    const m = part.trim().match(/^(\d{1,2}):?(\d{2})?\s*-\s*(\d{1,2}):?(\d{2})?$/);
    if (!m) return null;
    out.push({ start: `${m[1].padStart(2, "0")}:${m[2] ?? "00"}`, end: `${m[3].padStart(2, "0")}:${m[4] ?? "00"}` });
  }
  return out;
};

const ResourceRow = ({ r, hours, kinds, staff, onChanged }: { readonly r: WorkbenchData["model"]["resources"][number] | null; readonly hours: WorkbenchData["model"]["hours"]; readonly kinds: ReadonlyArray<string>; readonly staff: WorkbenchData["staff"]; readonly onChanged: Done }) => {
  const [open, setOpen] = useState(r === null);
  const [f, setF] = useState({ name: r?.name ?? "", kind: r?.kind ?? "staff", capacity: r?.capacity ?? 1, active: r?.active ?? true, staffId: r?.staff_id ?? "" });
  const [lines, setLines] = useState<Array<string>>(r ? [1, 2, 3, 4, 5, 6, 7].map((d) => dayLine(hours, r.id, d)) : []);
  const { pending, go, note } = useRun(() => { onChanged(); if (!r) setF({ name: "", kind: "staff", capacity: 1, active: true, staffId: "" }); });
  const saveHours = () => {
    if (!r) return;
    const rows: Array<{ weekday: number; start: string; end: string }> = [];
    for (let i = 0; i < 7; i++) {
      const parsed = parseLine(lines[i] ?? "");
      if (parsed === null) return go(async () => ({ ok: false as const, error: `${WEEKDAY_SHORT[i + 1]}: viết giờ như "09:00-12:00, 13:00-18:00" hoặc để trống nếu nghỉ.` }));
      for (const w of parsed) rows.push({ weekday: i + 1, ...w });
    }
    go(() => saveHoursAction(r.id, rows), "Đã lưu giờ làm việc.");
  };
  return (
    <li className="border-b border-separator py-3 last:border-b-0">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <button type="button" className="min-w-0 text-left" onClick={() => setOpen((v) => !v)} aria-expanded={open}>
          <span className="font-semibold">{r ? r.name : "Thêm người hoặc phòng"}</span>
          {r ? <span className="text-sm text-muted"> · {r.kind} · tối đa {r.capacity} khách cùng lúc{r.active ? "" : " · đã ngưng"}</span> : null}
        </button>
        <Button size="sm" variant="outline" onPress={() => setOpen((v) => !v)}>{open ? "Thu gọn" : r ? "Sửa và giờ làm" : "Mở form"}</Button>
      </div>
      {open ? (
        <div className="mt-3 flex flex-col gap-3">
          <form className="flex flex-col gap-3" onSubmit={(e) => { e.preventDefault(); go(() => saveResourceAction({ id: r?.id, name: f.name, kind: f.kind, capacity: f.capacity, color: r?.color ?? "", active: f.active, staffId: f.staffId })); }}>
            <div className={GRID2}>
              <label className={LABEL}>Tên<input className={FIELD} value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} required /></label>
              <label className={LABEL}>Loại (thợ, phòng, ghế, khoang...)<input className={FIELD} list="booking-kinds-r" value={f.kind} onChange={(e) => setF({ ...f, kind: e.target.value })} /></label>
              <label className={LABEL}>Số khách cùng lúc<input className={FIELD} type="number" min={1} value={f.capacity} onChange={(e) => setF({ ...f, capacity: Number(e.target.value) || 1 })} /></label>
              {staff.length ? (
                <label className={LABEL}>Gắn với nhân viên (lấy ngày nghỉ phép từ Lịch ca)
                  <select className={FIELD} value={f.staffId} onChange={(e) => setF({ ...f, staffId: e.target.value })}>
                    <option value="">Không gắn</option>
                    {staff.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
                  </select>
                </label>
              ) : null}
            </div>
            <datalist id="booking-kinds-r">{kinds.map((k) => <option key={k} value={k} />)}</datalist>
            <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={f.active} onChange={(e) => setF({ ...f, active: e.target.checked })} />Đang làm việc</label>
            <div className="flex flex-wrap items-center gap-2">
              <Button type="submit" size="sm" variant="primary" isPending={pending}>{r ? "Lưu" : "Thêm"}</Button>
              {r ? <Button size="sm" variant="danger-soft" isDisabled={pending} onPress={() => { if (window.confirm(`Xóa "${r.name}"? Nếu đã có lịch hẹn, chỉ ngưng sử dụng.`)) go(() => deleteResourceAction(r.id), "Đã xóa."); }}>Xóa</Button> : null}
              {note}
            </div>
          </form>
          {r ? (
            <div className="flex flex-col gap-2">
              <Text size="sm" weight="semibold">Giờ làm việc mỗi tuần</Text>
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                {[1, 2, 3, 4, 5, 6, 7].map((d) => (
                  <label key={d} className="flex items-center gap-2 text-sm">
                    <span className="w-8 shrink-0 font-medium">{WEEKDAY_SHORT[d]}</span>
                    <input className={FIELD} value={lines[d - 1] ?? ""} onChange={(e) => setLines(lines.map((x, i) => (i === d - 1 ? e.target.value : x)))} placeholder="nghỉ" aria-label={`Giờ làm ${WEEKDAY_SHORT[d]}`} />
                  </label>
                ))}
              </div>
              <div><Button size="sm" variant="primary" isPending={pending} onPress={saveHours}>Lưu giờ làm việc</Button></div>
            </div>
          ) : null}
        </div>
      ) : null}
    </li>
  );
};

/* ------------------------------------------------------------------ exceptions */

const ExceptionForm = ({ data, onChanged }: { readonly data: WorkbenchData; readonly onChanged: Done }) => {
  const [f, setF] = useState({ resourceId: "", date: data.today, closed: true, start: "09:00", end: "12:00", note: "" });
  const { pending, go, note } = useRun(onChanged);
  const names = new Map(data.model.resources.map((r) => [r.id, r.name]));
  return (
    <Section title="Ngày nghỉ và giờ đặc biệt" hint="Nghỉ lễ, đi vắng hoặc đổi giờ một ngày. Để trống người/phòng nếu áp dụng cho cả cơ sở.">
      <form className="flex flex-col gap-3" onSubmit={(e) => { e.preventDefault(); go(() => addExceptionAction(f), "Đã thêm."); }}>
        <div className={GRID2}>
          <label className={LABEL}>Áp dụng cho
            <select className={FIELD} value={f.resourceId} onChange={(e) => setF({ ...f, resourceId: e.target.value })}>
              <option value="">Cả cơ sở</option>
              {data.model.resources.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
            </select>
          </label>
          <label className={LABEL}>Ngày<input className={FIELD} type="date" value={f.date} onChange={(e) => setF({ ...f, date: e.target.value })} required /></label>
          <label className={LABEL}>Ghi chú<input className={FIELD} value={f.note} onChange={(e) => setF({ ...f, note: e.target.value })} placeholder="Nghỉ lễ Quốc khánh" /></label>
        </div>
        <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={f.closed} onChange={(e) => setF({ ...f, closed: e.target.checked })} />Nghỉ cả ngày</label>
        {!f.closed ? (
          <div className="grid grid-cols-2 gap-3 sm:max-w-sm">
            <label className={LABEL}>Mở lúc<input className={FIELD} type="time" value={f.start} onChange={(e) => setF({ ...f, start: e.target.value })} /></label>
            <label className={LABEL}>Đóng lúc<input className={FIELD} type="time" value={f.end} onChange={(e) => setF({ ...f, end: e.target.value })} /></label>
          </div>
        ) : null}
        <div className="flex items-center gap-3"><Button type="submit" size="sm" variant="primary" isPending={pending}>Thêm</Button>{note}</div>
      </form>
      {data.exceptionList.length ? (
        <ul className="m-0 list-none p-0">
          {data.exceptionList.map((e) => (
            <li key={e.id} className="flex items-center justify-between gap-2 border-t border-separator py-2 text-sm">
              <span>{e.date.split("-").reverse().join("/")} · {e.resourceId ? names.get(e.resourceId) : "Cả cơ sở"} · {e.closed ? "nghỉ" : `${e.start}-${e.end}`}{e.note ? ` · ${e.note}` : ""}</span>
              <Button size="sm" variant="outline" isDisabled={pending} onPress={() => go(() => deleteExceptionAction(e.id), "Đã xóa.")}>Xóa</Button>
            </li>
          ))}
        </ul>
      ) : null}
    </Section>
  );
};

export const SetupPanel = ({ data, onChanged }: { readonly data: WorkbenchData; readonly onChanged: Done }) => {
  const kinds = [...new Set(data.model.resources.map((r) => r.kind))];
  return (
    <div className="flex flex-col gap-4">
      <Section title="Dịch vụ" hint="Mỗi dịch vụ có thời lượng, khoảng nghỉ sau buổi hẹn, giá và loại người hoặc phòng cần.">
        <ul className="m-0 list-none p-0">
          {data.model.services.map((s) => <ServiceRow key={s.id + s.name + s.duration_min + s.active} d={{ id: s.id, name: s.name, durationMin: s.duration_min, bufferMin: s.buffer_min, price: s.price_vnd === null ? "" : String(s.price_vnd), resourceKind: s.resource_kind ?? "", followupDays: s.followup_days ? String(s.followup_days) : "", active: s.active, description: s.description }} kinds={kinds} onChanged={onChanged} />)}
          <ServiceRow d={emptySvc} kinds={kinds} onChanged={onChanged} startOpen={data.model.services.length === 0} />
        </ul>
      </Section>
      <Section title="Người và phòng" hint="Thợ, bác sĩ, phòng, ghế, khoang sửa xe... Mỗi nơi có giờ làm việc riêng. Dịch vụ chỉ xếp được vào đúng loại nó cần.">
        <ul className="m-0 list-none p-0">
          {data.model.resources.map((r) => <ResourceRow key={r.id + r.name + r.capacity + r.active + r.kind} r={r} hours={data.model.hours} kinds={kinds} staff={data.staff} onChanged={onChanged} />)}
          <ResourceRow r={null} hours={data.model.hours} kinds={kinds} staff={data.staff} onChanged={onChanged} />
        </ul>
      </Section>
      <ExceptionForm data={data} onChanged={onChanged} />
      <PolicyForm data={data} onChanged={onChanged} />
      <PublicForm data={data} onChanged={onChanged} />
    </div>
  );
};
