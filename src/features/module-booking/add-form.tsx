"use client";

import { useState, useTransition } from "react";
import { cn } from "@heroui/react";
import { Button } from "@starci/grammar/common";
import type { WorkbenchData } from "@/lib/module-booking-view";
import { addBookingAction } from "./actions";
import { FIELD, LABEL, vnd } from "./shared";

/** "Thêm lịch hẹn": the manual form. A taken slot is refused with the reason; the owner can then choose to stack it anyway. */
export const AddBookingDialog = ({ data, defaultDate, onClose, onAdded }: { readonly data: WorkbenchData; readonly defaultDate: string; readonly onClose: () => void; readonly onAdded: () => void }) => {
  const services = data.model.services.filter((s) => s.active);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [serviceId, setServiceId] = useState(services[0]?.id ?? "");
  const [resourceId, setResourceId] = useState("");
  const [date, setDate] = useState(defaultDate);
  const [time, setTime] = useState("09:00");
  const [party, setParty] = useState(1);
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [canForce, setCanForce] = useState(false);
  const [pending, start] = useTransition();
  const svc = services.find((s) => s.id === serviceId);
  const resources = data.model.resources.filter((r) => r.active && (!svc?.resource_kind || r.kind === svc.resource_kind));

  const submit = (force: boolean) => {
    setError(null);
    start(async () => {
      const res = await addBookingAction({ name, phone, serviceId, resourceId, date, time, party, note, force });
      if (!res.ok) return setError(res.error);
      if (!res.data.ok) {
        setError(res.data.reason ?? "Không thêm được lịch hẹn.");
        setCanForce(true);
        return;
      }
      onAdded();
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 md:items-center md:p-4" role="dialog" aria-modal="true" aria-label="Thêm lịch hẹn" onClick={onClose}>
      <form
        className="max-h-[92dvh] w-full overflow-y-auto rounded-t-2xl bg-surface p-4 shadow-xl md:max-w-lg md:rounded-2xl"
        onClick={(e) => e.stopPropagation()}
        onSubmit={(e) => { e.preventDefault(); submit(false); }}
      >
        <h2 className="text-lg font-semibold">Thêm lịch hẹn</h2>
        {services.length === 0 ? <p className="mt-2 text-sm text-muted">Bạn chưa có dịch vụ nào. Vào tab Thiết lập để thêm dịch vụ trước.</p> : null}
        <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
          <label className={LABEL}>Tên khách<input className={FIELD} value={name} onChange={(e) => setName(e.target.value)} required autoComplete="off" /></label>
          <label className={LABEL}>Số điện thoại<input className={FIELD} value={phone} onChange={(e) => setPhone(e.target.value)} inputMode="tel" autoComplete="off" /></label>
          <label className={cn(LABEL, "sm:col-span-2")}>Dịch vụ
            <select className={FIELD} value={serviceId} onChange={(e) => { setServiceId(e.target.value); setResourceId(""); }}>
              {services.map((s) => <option key={s.id} value={s.id}>{s.name} · {s.duration_min} phút{s.price_vnd ? ` · ${vnd(s.price_vnd)}` : ""}</option>)}
            </select>
          </label>
          <label className={LABEL}>Ngày<input className={FIELD} type="date" value={date} onChange={(e) => setDate(e.target.value)} required /></label>
          <label className={LABEL}>Giờ<input className={FIELD} type="time" value={time} onChange={(e) => setTime(e.target.value)} required step={data.model.settings.slot_step_min * 60} /></label>
          <label className={LABEL}>Người hoặc phòng
            <select className={FIELD} value={resourceId} onChange={(e) => setResourceId(e.target.value)}>
              <option value="">Tự chọn chỗ còn trống</option>
              {resources.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
            </select>
          </label>
          <label className={LABEL}>Số khách<input className={FIELD} type="number" min={1} max={200} value={party} onChange={(e) => setParty(Math.max(1, Number(e.target.value) || 1))} /></label>
          <label className={cn(LABEL, "sm:col-span-2")}>Ghi chú<input className={FIELD} value={note} onChange={(e) => setNote(e.target.value)} placeholder="Yêu cầu đặc biệt của khách" /></label>
        </div>
        {error ? <p role="alert" className="mt-3 text-sm text-danger">{error}</p> : null}
        <div className="mt-4 flex flex-wrap justify-end gap-2">
          <Button variant="outline" onPress={onClose} isDisabled={pending}>Đóng</Button>
          {canForce ? <Button variant="danger-soft" onPress={() => submit(true)} isDisabled={pending}>Vẫn xếp chồng</Button> : null}
          <Button variant="primary" type="submit" isPending={pending} isDisabled={pending || services.length === 0}>Thêm lịch hẹn</Button>
        </div>
      </form>
    </div>
  );
};
