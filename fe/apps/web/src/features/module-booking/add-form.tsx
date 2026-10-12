"use client";

import { useState, useTransition } from "react";
import { parseDate, parseTime, type DateValue } from "@internationalized/date";
import { Alert, Button, DateField, Dialog, Input, NumberField, Select, Text, TimeField, type TimeFieldProps } from "@starci/grammar/common";

type TimeValue = NonNullable<TimeFieldProps["value"]>;
import type { WorkbenchData } from "@/lib/module-booking-view";
import { addBookingAction } from "./actions";
import { GRID_PAIR, STACK, WIDE2, hhmmOf, vnd } from "./shared";

/** Select id for "let NIVO pick a free resource" (a list key cannot be empty). */
const AUTO_RESOURCE = "auto";

/** "Thêm lịch hẹn": the manual form. A taken slot is refused with the reason; the owner can then choose to stack it anyway. */
export const AddBookingDialog = ({ data, defaultDate, onClose, onAdded }: { readonly data: WorkbenchData; readonly defaultDate: string; readonly onClose: () => void; readonly onAdded: () => void }) => {
  const services = data.model.services.filter((s) => s.active);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [serviceId, setServiceId] = useState(services[0]?.id ?? "");
  const [resourceId, setResourceId] = useState("");
  const [date, setDate] = useState<DateValue | null>(() => parseDate(defaultDate));
  const [time, setTime] = useState<TimeValue | null>(() => parseTime("09:00"));
  const [party, setParty] = useState(1);
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [canForce, setCanForce] = useState(false);
  const [pending, start] = useTransition();
  const svc = services.find((s) => s.id === serviceId);
  const resources = data.model.resources.filter((r) => r.active && (!svc?.resource_kind || r.kind === svc.resource_kind));
  const isIncomplete = services.length === 0 || !name.trim() || !serviceId || date === null || time === null;

  const submit = (force: boolean) => {
    if (date === null || time === null) return;
    setError(null);
    start(async () => {
      const res = await addBookingAction({ name, phone, serviceId, resourceId, date: date.toString(), time: hhmmOf(time), party, note, force });
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
    <Dialog
      isOpen
      onOpenChange={(open) => { if (!open) onClose(); }}
      size="md"
      title="Thêm lịch hẹn"
      closeLabel="Đóng"
      footer={
        <>
          <Button variant="outline" onPress={onClose} isDisabled={pending}>Đóng</Button>
          {canForce ? <Button variant="danger-soft" onPress={() => submit(true)} isDisabled={pending}>Vẫn xếp chồng</Button> : null}
          <Button variant="primary" isPending={pending} isDisabled={pending || isIncomplete} onPress={() => submit(false)}>Thêm lịch hẹn</Button>
        </>
      }
    >
      <div className={STACK}>
        {services.length === 0 ? <Text size="sm" tone="muted">Bạn chưa có dịch vụ nào. Vào tab Thiết lập để thêm dịch vụ trước.</Text> : null}
        <div className={GRID_PAIR}>
          <Input id="bk-add-name" name="name" label="Tên khách" variant="secondary" isRequired value={name} onValueChange={setName} />
          <Input id="bk-add-phone" name="phone" kind="tel" label="Số điện thoại" variant="secondary" value={phone} onValueChange={setPhone} />
          <div className={WIDE2}>
            <Select
              label="Dịch vụ"
              variant="secondary"
              options={services.map((s) => ({ id: s.id, label: `${s.name} · ${s.duration_min} phút${s.price_vnd ? ` · ${vnd(s.price_vnd)}` : ""}` }))}
              value={serviceId || null}
              onValueChange={(v) => { setServiceId(v ?? ""); setResourceId(""); }}
            />
          </div>
          <DateField label="Ngày" variant="secondary" isRequired value={date} onValueChange={setDate} />
          <TimeField label="Giờ" variant="secondary" isRequired granularity="minute" hourCycle={24} value={time} onValueChange={setTime} />
          <Select
            label="Người hoặc phòng"
            variant="secondary"
            options={[{ id: AUTO_RESOURCE, label: "Tự chọn chỗ còn trống" }, ...resources.map((r) => ({ id: r.id, label: r.name }))]}
            value={resourceId || AUTO_RESOURCE}
            onValueChange={(v) => setResourceId(!v || v === AUTO_RESOURCE ? "" : v)}
          />
          <NumberField label="Số khách" variant="secondary" minValue={1} maxValue={200} step={1} value={party} onValueChange={(v) => setParty(Number.isFinite(v) ? Math.max(1, v) : 1)} />
          <div className={WIDE2}>
            <Input id="bk-add-note" name="note" label="Ghi chú" variant="secondary" placeholder="Yêu cầu đặc biệt của khách" value={note} onValueChange={setNote} />
          </div>
        </div>
        {error ? <Alert tone="negative" title={error} /> : null}
      </div>
    </Dialog>
  );
};
