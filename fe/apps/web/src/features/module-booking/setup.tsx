"use client";

import { useState, useTransition, type ReactNode } from "react";
import { parseDate, parseTime, type DateValue } from "@internationalized/date";
import {
  Alert, AlertDialog, Button, Checkbox, ComboBox, DateField, Form, Input, Link, List, ListItem, NumberField, SectionHeader, Select, SurfaceAccordionCard, SurfaceCard, Text, TimeField, type TimeFieldProps,
} from "@starci/grammar/common";
import type { WorkbenchData } from "@/lib/module-booking-view";
import {
  addExceptionAction, deleteExceptionAction, deleteResourceAction, deleteServiceAction, saveHoursAction, savePublicPageAction, saveResourceAction, saveServiceAction, saveSettingsAction,
} from "./actions";
import { GRID2, GRID_PAIR, PLAIN_ROW, REGIONS, ROW, STACK, WEEKDAY_SHORT, WIDE, WIDE2, hhmmOf, vnd } from "./shared";

type Done = () => void;
type TimeValue = NonNullable<TimeFieldProps["value"]>;
const useRun = (onChanged: Done) => {
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const go = (fn: () => Promise<{ ok: true; data: unknown } | { ok: false; error: string }>, okText = "Đã lưu.") =>
    start(async () => {
      const r = await fn();
      setMsg(r.ok ? { ok: true, text: okText } : { ok: false, text: r.error });
      if (r.ok) onChanged();
    });
  const note = msg ? <Alert key={msg.text} tone={msg.ok ? "affirmative" : "negative"} title={msg.text} /> : null;
  return { pending, go, note };
};

/** One setup region on the canvas: its heading, then one surface holding the form. */
const Section = ({ title, hint, children }: { readonly title: string; readonly hint?: string; readonly children: ReactNode }) => (
  <SurfaceCard label={title} headingLevel={2}>
    <div className={STACK}>
      {hint ? <Text size="sm" tone="muted">{hint}</Text> : null}
      {children}
    </div>
  </SurfaceCard>
);

/** Select id for "the whole place" (a list key cannot be empty). */
const WHOLE_PLACE = "all";
/** Select id for "not linked to a staff member". */
const NO_STAFF = "none";

/* ------------------------------------------------------------------ policy */

const PolicyForm = ({ data, onChanged }: { readonly data: WorkbenchData; readonly onChanged: Done }) => {
  const s = data.model.settings;
  const [f, setF] = useState({ cancelWindowHours: s.cancel_window_hours, depositPct: s.deposit_pct, lateCancelFeePct: s.late_cancel_fee_pct, noShowFeeVnd: s.no_show_fee_vnd, minLeadMin: s.min_lead_min, maxAdvanceDays: s.max_advance_days, slotStepMin: s.slot_step_min, autoConfirm: s.auto_confirm, handoffOrder: s.handoff_order, address: s.address, timezone: s.timezone });
  const { pending, go, note } = useRun(onChanged);
  type NumKey = "cancelWindowHours" | "depositPct" | "lateCancelFeePct" | "noShowFeeVnd" | "minLeadMin" | "maxAdvanceDays" | "slotStepMin";
  const n = (k: NumKey, label: string) => (
    <NumberField label={label} variant="secondary" minValue={0} step={1} value={f[k]} onValueChange={(v) => setF({ ...f, [k]: Number.isFinite(v) ? v : 0 })} />
  );
  return (
    <Section title="Chính sách đặt lịch" hint="Khách đổi hoặc hủy trong khung giờ này thì NIVO hỏi bạn trước. Phí hủy chỉ được ghi sau khi bạn đồng ý.">
      <Form label="Chính sách đặt lịch" isPending={pending} onSubmit={() => go(() => saveSettingsAction(f))}>
        <div className={STACK}>
          <div className={GRID2}>
            {n("cancelWindowHours", "Đổi hoặc hủy miễn phí trước (giờ)")}
            {n("lateCancelFeePct", "Phí hủy sát giờ (% giá dịch vụ)")}
            {n("noShowFeeVnd", "Phí khách không đến (₫)")}
            {n("depositPct", "Đặt cọc (% giá dịch vụ)")}
            {n("minLeadMin", "Đặt trước tối thiểu (phút)")}
            {n("maxAdvanceDays", "Cho đặt trước tối đa (ngày)")}
            {n("slotStepMin", "Bước giờ hẹn (phút)")}
            <div className={WIDE2}>
              <Input id="bk-policy-address" name="address" label="Địa chỉ gửi cho khách" variant="secondary" value={f.address} onValueChange={(v) => setF({ ...f, address: v })} />
            </div>
          </div>
          <Checkbox variant="secondary" label="Chỗ trống trong chính sách thì tự xác nhận (nếu tắt, mọi yêu cầu đều chờ bạn duyệt)" isSelected={f.autoConfirm} onSelectedChange={(v) => setF({ ...f, autoConfirm: v })} />
          <Checkbox variant="secondary" label="Lịch xong có giá thì chuyển cho Bán hàng thành đơn hàng" isSelected={f.handoffOrder} onSelectedChange={(v) => setF({ ...f, handoffOrder: v })} />
          <div className={ROW}><Button type="submit" variant="primary" size="sm" isPending={pending}>Lưu chính sách</Button></div>
          {note}
        </div>
      </Form>
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
      <Form label="Trang đặt lịch cho khách" isPending={pending} onSubmit={() => go(() => savePublicPageAction({ enabled, slug, note: noteText }))}>
        <div className={STACK}>
          <Checkbox variant="secondary" label="Bật trang đặt lịch" isSelected={enabled} onSelectedChange={setEnabled} />
          <div className={GRID2}>
            <Input id="bk-public-slug" name="slug" label="Địa chỉ (/b/...)" variant="secondary" placeholder="ten-cua-hang" value={slug} onValueChange={setSlug} />
            <div className={WIDE2}>
              <Input id="bk-public-note" name="note" label="Lời nhắn trên trang" variant="secondary" placeholder="Ví dụ: Mang theo thẻ bảo hành" value={noteText} onValueChange={setNoteText} />
            </div>
          </div>
          {s.public_slug && s.public_enabled ? (
            <Text size="sm" startContent={<Text as="span" size="sm" tone="muted">Đường dẫn của bạn:</Text>}>
              <Link href={`/b/${s.public_slug}`} kind="external" externalHint="(mở trong thẻ mới)">{`/b/${s.public_slug}`}</Link>
            </Text>
          ) : null}
          <div className={ROW}><Button type="submit" variant="primary" size="sm" isPending={pending}>Lưu</Button></div>
          {note}
        </div>
      </Form>
    </Section>
  );
};

/* ------------------------------------------------------------------ services */

type SvcDraft = { id?: string; name: string; durationMin: number; bufferMin: number; price: string; resourceKind: string; followupDays: string; active: boolean; description: string };
const emptySvc: SvcDraft = { name: "", durationMin: 30, bufferMin: 0, price: "", resourceKind: "", followupDays: "", active: true, description: "" };
const NEW_ID = "new";

const svcSummary = (d: SvcDraft): string =>
  `${d.durationMin} phút${d.bufferMin ? ` + nghỉ ${d.bufferMin}` : ""}${d.price ? ` · ${vnd(Number(d.price))}` : ""}${d.resourceKind ? ` · cần ${d.resourceKind}` : ""}${d.active ? "" : " · đang tạm ngưng"}`;

/** The summary line of a disclosure row: the name, then what it is. */
const Summary = ({ title, detail }: { readonly title: string; readonly detail?: string }) => (
  <div className={STACK}>
    <Text weight="semibold">{title}</Text>
    {detail ? <Text size="sm" tone="muted">{detail}</Text> : null}
  </div>
);

const ServiceForm = ({ d, kinds, onChanged }: { readonly d: SvcDraft; readonly kinds: ReadonlyArray<string>; readonly onChanged: Done }) => {
  const [f, setF] = useState(d);
  const { pending, go, note } = useRun(() => { onChanged(); if (!d.id) { setF(emptySvc); } });
  const [isDeleting, setIsDeleting] = useState(false);
  return (
    <Form label={d.id ? d.name : "Thêm dịch vụ"} isPending={pending} onSubmit={() => go(() => saveServiceAction({ id: f.id, name: f.name, durationMin: f.durationMin, bufferMin: f.bufferMin, priceVnd: f.price.trim() ? Number(f.price.replace(/[^\d]/g, "")) : null, resourceKind: f.resourceKind, followupDays: f.followupDays ? Number(f.followupDays) : null, active: f.active, description: f.description }))}>
      <div className={STACK}>
        <div className={GRID2}>
          <Input id={`bk-svc-name-${d.id ?? NEW_ID}`} name="name" label="Tên dịch vụ" variant="secondary" isRequired value={f.name} onValueChange={(v) => setF({ ...f, name: v })} />
          <NumberField label="Thời lượng (phút)" variant="secondary" minValue={5} step={5} value={f.durationMin} onValueChange={(v) => setF({ ...f, durationMin: Number.isFinite(v) ? v : 30 })} />
          <NumberField label="Nghỉ sau buổi hẹn (phút)" variant="secondary" minValue={0} step={5} value={f.bufferMin} onValueChange={(v) => setF({ ...f, bufferMin: Number.isFinite(v) ? v : 0 })} />
          <Input id={`bk-svc-price-${d.id ?? NEW_ID}`} name="price" label="Giá (₫)" variant="secondary" placeholder="Để trống nếu chưa có giá" value={f.price} onValueChange={(v) => setF({ ...f, price: v })} />
          <ComboBox
            id={`bk-svc-kind-${d.id ?? NEW_ID}`}
            name="resource_kind"
            label="Loại người/phòng cần"
            variant="secondary"
            placeholder="Để trống = bất kỳ"
            allowsCustomValue
            menuTrigger="focus"
            options={kinds.map((k) => ({ id: k, label: k }))}
            inputValue={f.resourceKind}
            onInputChange={(v) => setF({ ...f, resourceKind: v })}
            onValueChange={(v) => { if (v) setF({ ...f, resourceKind: v }); }}
          />
          <Input id={`bk-svc-followup-${d.id ?? NEW_ID}`} name="followup_days" label="Mời quay lại sau (ngày)" variant="secondary" placeholder="Để trống = không mời" value={f.followupDays} onValueChange={(v) => setF({ ...f, followupDays: v.replace(/[^\d]/g, "") })} />
          <div className={WIDE}>
            <Input id={`bk-svc-desc-${d.id ?? NEW_ID}`} name="description" label="Mô tả ngắn" variant="secondary" value={f.description} onValueChange={(v) => setF({ ...f, description: v })} />
          </div>
        </div>
        <Checkbox variant="secondary" label="Đang nhận đặt" isSelected={f.active} onSelectedChange={(v) => setF({ ...f, active: v })} />
        <div className={ROW}>
          <Button type="submit" size="sm" variant="primary" isPending={pending}>{d.id ? "Lưu dịch vụ" : "Thêm dịch vụ"}</Button>
          {d.id ? <Button size="sm" variant="danger-soft" isDisabled={pending} onPress={() => setIsDeleting(true)}>Xóa</Button> : null}
        </div>
        {note}
      </div>
      {d.id && isDeleting ? (
        <AlertDialog
          isOpen
          onOpenChange={(open) => { if (!open) setIsDeleting(false); }}
          tone="negative"
          title={`Xóa dịch vụ "${d.name}"?`}
          description="Nếu đã có lịch hẹn, dịch vụ chỉ bị ngưng nhận đặt."
          confirmLabel="Xóa dịch vụ"
          cancelLabel="Giữ lại"
          onConfirm={() => go(() => deleteServiceAction(d.id as string), "Đã xóa.")}
        />
      ) : null}
    </Form>
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

type Resource = WorkbenchData["model"]["resources"][number];

const ResourceForm = ({ r, hours, kinds, staff, onChanged }: { readonly r: Resource | null; readonly hours: WorkbenchData["model"]["hours"]; readonly kinds: ReadonlyArray<string>; readonly staff: WorkbenchData["staff"]; readonly onChanged: Done }) => {
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
  const key = r?.id ?? NEW_ID;
  const [isDeleting, setIsDeleting] = useState(false);
  return (
    <div className={STACK}>
      <Form label={r ? r.name : "Thêm người hoặc phòng"} isPending={pending} onSubmit={() => go(() => saveResourceAction({ id: r?.id, name: f.name, kind: f.kind, capacity: f.capacity, color: r?.color ?? "", active: f.active, staffId: f.staffId }))}>
        <div className={STACK}>
          <div className={GRID2}>
            <Input id={`bk-res-name-${key}`} name="name" label="Tên" variant="secondary" isRequired value={f.name} onValueChange={(v) => setF({ ...f, name: v })} />
            <ComboBox
              id={`bk-res-kind-${key}`}
              name="kind"
              label="Loại (thợ, phòng, ghế, khoang...)"
              variant="secondary"
              allowsCustomValue
              menuTrigger="focus"
              options={kinds.map((k) => ({ id: k, label: k }))}
              inputValue={f.kind}
              onInputChange={(v) => setF({ ...f, kind: v })}
              onValueChange={(v) => { if (v) setF({ ...f, kind: v }); }}
            />
            <NumberField label="Số khách cùng lúc" variant="secondary" minValue={1} step={1} value={f.capacity} onValueChange={(v) => setF({ ...f, capacity: Number.isFinite(v) ? v : 1 })} />
            {staff.length ? (
              <Select
                label="Gắn với nhân viên (lấy ngày nghỉ phép từ Lịch ca)"
                variant="secondary"
                options={[{ id: NO_STAFF, label: "Không gắn" }, ...staff.map((s) => ({ id: s.id, label: s.name }))]}
                value={f.staffId || NO_STAFF}
                onValueChange={(v) => setF({ ...f, staffId: !v || v === NO_STAFF ? "" : v })}
              />
            ) : null}
          </div>
          <Checkbox variant="secondary" label="Đang làm việc" isSelected={f.active} onSelectedChange={(v) => setF({ ...f, active: v })} />
          <div className={ROW}>
            <Button type="submit" size="sm" variant="primary" isPending={pending}>{r ? "Lưu" : "Thêm"}</Button>
            {r ? <Button size="sm" variant="danger-soft" isDisabled={pending} onPress={() => setIsDeleting(true)}>Xóa</Button> : null}
          </div>
        </div>
      </Form>
      {r ? (
        <div className={STACK}>
          <SectionHeader level={4} title="Giờ làm việc mỗi tuần" description='Viết như "09:00-12:00, 13:00-18:00"; để trống nếu nghỉ.' />
          <div className={GRID_PAIR}>
            {[1, 2, 3, 4, 5, 6, 7].map((d) => (
              <Input
                key={d}
                id={`bk-res-hours-${r.id}-${d}`}
                name={`hours_${d}`}
                label={`Giờ làm ${WEEKDAY_SHORT[d]}`}
                variant="secondary"
                placeholder="nghỉ"
                value={lines[d - 1] ?? ""}
                onValueChange={(v) => setLines(lines.map((x, i) => (i === d - 1 ? v : x)))}
              />
            ))}
          </div>
          <div className={ROW}><Button size="sm" variant="primary" isPending={pending} onPress={saveHours}>Lưu giờ làm việc</Button></div>
        </div>
      ) : null}
      {note}
      {r && isDeleting ? (
        <AlertDialog
          isOpen
          onOpenChange={(open) => { if (!open) setIsDeleting(false); }}
          tone="negative"
          title={`Xóa "${r.name}"?`}
          description="Nếu đã có lịch hẹn, chỉ ngưng sử dụng."
          confirmLabel="Xóa"
          cancelLabel="Giữ lại"
          onConfirm={() => go(() => deleteResourceAction(r.id), "Đã xóa.")}
        />
      ) : null}
    </div>
  );
};

/* ------------------------------------------------------------------ exceptions */

const ExceptionForm = ({ data, onChanged }: { readonly data: WorkbenchData; readonly onChanged: Done }) => {
  const [resourceId, setResourceId] = useState("");
  const [date, setDate] = useState<DateValue | null>(() => parseDate(data.today));
  const [closed, setClosed] = useState(true);
  const [startT, setStartT] = useState<TimeValue | null>(() => parseTime("09:00"));
  const [endT, setEndT] = useState<TimeValue | null>(() => parseTime("12:00"));
  const [noteText, setNoteText] = useState("");
  const { pending, go, note } = useRun(onChanged);
  const names = new Map(data.model.resources.map((r) => [r.id, r.name]));
  const submit = () => {
    if (date === null) return;
    go(() => addExceptionAction({ resourceId, date: date.toString(), closed, start: startT ? hhmmOf(startT) : "09:00", end: endT ? hhmmOf(endT) : "12:00", note: noteText }), "Đã thêm.");
  };
  return (
    <Section title="Ngày nghỉ và giờ đặc biệt" hint="Nghỉ lễ, đi vắng hoặc đổi giờ một ngày. Để trống người/phòng nếu áp dụng cho cả cơ sở.">
      <Form label="Ngày nghỉ và giờ đặc biệt" isPending={pending} onSubmit={submit}>
        <div className={STACK}>
          <div className={GRID2}>
            <Select
              label="Áp dụng cho"
              variant="secondary"
              options={[{ id: WHOLE_PLACE, label: "Cả cơ sở" }, ...data.model.resources.map((r) => ({ id: r.id, label: r.name }))]}
              value={resourceId || WHOLE_PLACE}
              onValueChange={(v) => setResourceId(!v || v === WHOLE_PLACE ? "" : v)}
            />
            <DateField label="Ngày" variant="secondary" isRequired value={date} onValueChange={setDate} />
            <Input id="bk-exc-note" name="note" label="Ghi chú" variant="secondary" placeholder="Nghỉ lễ Quốc khánh" value={noteText} onValueChange={setNoteText} />
          </div>
          <Checkbox variant="secondary" label="Nghỉ cả ngày" isSelected={closed} onSelectedChange={setClosed} />
          {!closed ? (
            <div className={GRID_PAIR}>
              <TimeField label="Mở lúc" variant="secondary" granularity="minute" hourCycle={24} value={startT} onValueChange={setStartT} />
              <TimeField label="Đóng lúc" variant="secondary" granularity="minute" hourCycle={24} value={endT} onValueChange={setEndT} />
            </div>
          ) : null}
          <div className={ROW}><Button type="submit" size="sm" variant="primary" isPending={pending}>Thêm</Button></div>
          {note}
        </div>
      </Form>
      {data.exceptionList.length ? (
        <List label="Ngày nghỉ và giờ đặc biệt đã thêm">
          {data.exceptionList.map((e) => (
            <ListItem key={e.id} className={PLAIN_ROW}>
              <Text as="span" size="sm">{`${e.date.split("-").reverse().join("/")} · ${e.resourceId ? names.get(e.resourceId) ?? "" : "Cả cơ sở"} · ${e.closed ? "nghỉ" : `${e.start}-${e.end}`}${e.note ? ` · ${e.note}` : ""}`}</Text>
              <Button size="sm" variant="outline" isDisabled={pending} onPress={() => go(() => deleteExceptionAction(e.id), "Đã xóa.")}>Xóa</Button>
            </ListItem>
          ))}
        </List>
      ) : null}
    </Section>
  );
};

/* ------------------------------------------------------------------ the tab */

/** Opening one row of a disclosure list toggles only that row. */
const useOpenRows = (initial: ReadonlyArray<string>) => {
  const [open, setOpen] = useState<ReadonlySet<string>>(() => new Set(initial));
  const toggle = (id: string, isOpen: boolean) => setOpen((cur) => {
    const next = new Set(cur);
    if (isOpen) next.add(id);
    else next.delete(id);
    return next;
  });
  return { open, toggle };
};

export const SetupPanel = ({ data, onChanged }: { readonly data: WorkbenchData; readonly onChanged: Done }) => {
  const kinds = [...new Set(data.model.resources.map((r) => r.kind))];
  const services = useOpenRows(data.model.services.length === 0 ? [NEW_ID] : []);
  const resources = useOpenRows([NEW_ID]);
  const svcDrafts: ReadonlyArray<SvcDraft> = data.model.services.map((s) => ({ id: s.id, name: s.name, durationMin: s.duration_min, bufferMin: s.buffer_min, price: s.price_vnd === null ? "" : String(s.price_vnd), resourceKind: s.resource_kind ?? "", followupDays: s.followup_days ? String(s.followup_days) : "", active: s.active, description: s.description }));
  return (
    <div className={REGIONS}>
      <section className={STACK} aria-label="Dịch vụ">
        <SectionHeader level={2} title="Dịch vụ" count={data.model.services.length} description="Mỗi dịch vụ có thời lượng, khoảng nghỉ sau buổi hẹn, giá và loại người hoặc phòng cần." />
        <SurfaceAccordionCard
          ariaLabel="Dịch vụ"
          renderSummary={(summary: ReactNode) => summary}
          renderBody={(body: ReactNode) => body}
          onItemOpenChange={services.toggle}
          items={[
            ...svcDrafts.map((d) => ({
              id: d.id as string,
              isOpen: services.open.has(d.id as string),
              summaryRender: <Summary title={d.name} detail={svcSummary(d)} />,
              bodyRender: <ServiceForm key={`${d.id}${d.name}${d.durationMin}${d.active}`} d={d} kinds={kinds} onChanged={onChanged} />,
            })),
            { id: NEW_ID, isOpen: services.open.has(NEW_ID), summaryRender: <Summary title="Thêm dịch vụ" />, bodyRender: <ServiceForm d={emptySvc} kinds={kinds} onChanged={onChanged} /> },
          ]}
        />
      </section>
      <section className={STACK} aria-label="Người và phòng">
        <SectionHeader level={2} title="Người và phòng" count={data.model.resources.length} description="Thợ, bác sĩ, phòng, ghế, khoang sửa xe... Mỗi nơi có giờ làm việc riêng. Dịch vụ chỉ xếp được vào đúng loại nó cần." />
        <SurfaceAccordionCard
          ariaLabel="Người và phòng"
          renderSummary={(summary: ReactNode) => summary}
          renderBody={(body: ReactNode) => body}
          onItemOpenChange={resources.toggle}
          items={[
            ...data.model.resources.map((r) => ({
              id: r.id,
              isOpen: resources.open.has(r.id),
              summaryRender: <Summary title={r.name} detail={`${r.kind} · tối đa ${r.capacity} khách cùng lúc${r.active ? "" : " · đã ngưng"}`} />,
              bodyRender: <ResourceForm key={`${r.id}${r.name}${r.capacity}${r.active}${r.kind}`} r={r} hours={data.model.hours} kinds={kinds} staff={data.staff} onChanged={onChanged} />,
            })),
            { id: NEW_ID, isOpen: resources.open.has(NEW_ID), summaryRender: <Summary title="Thêm người hoặc phòng" />, bodyRender: <ResourceForm r={null} hours={data.model.hours} kinds={kinds} staff={data.staff} onChanged={onChanged} /> },
          ]}
        />
      </section>
      <ExceptionForm data={data} onChanged={onChanged} />
      <PolicyForm data={data} onChanged={onChanged} />
      <PublicForm data={data} onChanged={onChanged} />
    </div>
  );
};
