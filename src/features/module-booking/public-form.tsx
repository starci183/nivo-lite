"use client";

import { useEffect, useRef, useState } from "react";
import { Alert, Button, Form, Heading, HorizontalScrollRegion, Input, NumberField, RadioGroup, SegmentedControl, SurfaceCard, Text, TextAction } from "@starci/grammar/common";
import { addDays, localDate, localHhmm } from "@/lib/module-booking-availability";
import { dayText } from "@/lib/module-booking-copy";
import { HONEYPOT, PUBLIC_FORM, ROW, STACK, vnd } from "./shared";

type Svc = { readonly id: string; readonly name: string; readonly description: string; readonly durationMin: number; readonly priceVnd: number | null };
type Result = { readonly ok: boolean; readonly state: string; readonly message: string; readonly alternatives?: ReadonlyArray<string> };

/** The customer's side: service, day, time, then name and phone. No account, no login. */
export const PublicBookingForm = ({ slug, services, tz }: { readonly slug: string; readonly services: ReadonlyArray<Svc>; readonly tz: string }) => {
  const today = localDate(Date.now(), tz);
  const [serviceId, setServiceId] = useState(services[0]?.id ?? "");
  const [date, setDate] = useState(today);
  const [times, setTimes] = useState<ReadonlyArray<string> | null>(null);
  const [start, setStart] = useState("");
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [party, setParty] = useState(1);
  const [note, setNote] = useState("");
  const [website, setWebsite] = useState(""); // honeypot: a person never sees it
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<Result | null>(null);
  const token = useRef(typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : String(Date.now()));

  useEffect(() => {
    if (!serviceId) return;
    let cancelled = false;
    setTimes(null);
    setStart("");
    fetch(`/api/b/${slug}/slots?service=${serviceId}&date=${date}&party=${party}`)
      .then((r) => r.json() as Promise<{ times?: Array<string> }>)
      .then((j) => { if (!cancelled) setTimes(j.times ?? []); })
      .catch(() => { if (!cancelled) setTimes([]); });
    return () => { cancelled = true; };
  }, [slug, serviceId, date, party]);

  const submit = async () => {
    setBusy(true);
    setResult(null);
    try {
      const r = await fetch(`/api/b/${slug}/book`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ service_id: serviceId, start, name, phone, email, party, note, token: token.current, website }) });
      const j = (await r.json()) as Result & { error?: string };
      setResult({ ok: r.ok && j.ok !== false, state: j.state ?? "failed", message: j.message ?? (j.error === "rate_limited" ? "Bạn thao tác hơi nhanh, thử lại sau ít phút nhé." : "Chưa đặt được lịch, bạn thử lại nhé."), alternatives: j.alternatives });
      if (r.ok && j.state === "confirmed") token.current = crypto.randomUUID();
    } catch {
      setResult({ ok: false, state: "failed", message: "Mất kết nối, bạn thử lại nhé." });
    } finally {
      setBusy(false);
    }
  };

  const days = Array.from({ length: 14 }, (_, i) => addDays(today, i));
  const svc = services.find((s) => s.id === serviceId);

  if (result?.ok) {
    return (
      <SurfaceCard ariaLabel={result.state === "confirmed" ? "Đã xác nhận lịch hẹn" : "Đã gửi yêu cầu"}>
        <div className={STACK}>
          <Heading level={2}>{result.state === "confirmed" ? "Đã xác nhận lịch hẹn" : "Đã gửi yêu cầu"}</Heading>
          <Text live="polite">{result.message}</Text>
          <div className={ROW}>
            <TextAction size="sm" onPress={() => { setResult(null); setStart(""); token.current = crypto.randomUUID(); }}>Đặt thêm một lịch khác</TextAction>
          </div>
        </div>
      </SurfaceCard>
    );
  }

  return (
    <Form label="Đặt lịch hẹn" isPending={busy} validationBehavior="aria" onSubmit={() => void submit()}>
      <div className={PUBLIC_FORM}>
        <SurfaceCard ariaLabel="1. Chọn dịch vụ">
          {services.length === 0 ? (
            <div className={STACK}>
              <Heading level={2}>1. Chọn dịch vụ</Heading>
              <Text size="sm" tone="muted">Cửa hàng chưa mở nhận lịch qua trang này.</Text>
            </div>
          ) : (
            <RadioGroup
              label="1. Chọn dịch vụ"
              name="service"
              variant="secondary"
              options={services.map((s) => ({ value: s.id, label: s.name, description: `${s.durationMin} phút${s.priceVnd ? ` · ${vnd(s.priceVnd)}` : ""}${s.description ? ` · ${s.description}` : ""}` }))}
              value={serviceId}
              onValueChange={setServiceId}
            />
          )}
        </SurfaceCard>

        <SurfaceCard ariaLabel="2. Chọn ngày và giờ">
          <div className={STACK}>
            <HorizontalScrollRegion overflow="needed" isFocusable={false}>
              <SegmentedControl label="2. Chọn ngày và giờ" options={days.map((d) => ({ value: d, label: dayText(d) }))} value={date} onValueChange={setDate} />
            </HorizontalScrollRegion>
            {times === null ? (
              <Text size="sm" tone="muted" live="polite">Đang tìm giờ trống...</Text>
            ) : times.length === 0 ? (
              <Text size="sm" tone="muted" live="polite">Ngày này chưa còn giờ trống. Bạn chọn ngày khác nhé.</Text>
            ) : (
              <RadioGroup
                label="Chọn giờ"
                name="start"
                variant="secondary"
                orientation="horizontal"
                options={times.map((t) => ({ value: t, label: localHhmm(Date.parse(t), tz) }))}
                value={start || null}
                onValueChange={setStart}
              />
            )}
          </div>
        </SurfaceCard>

        <SurfaceCard ariaLabel="3. Thông tin của bạn">
          <div className={STACK}>
            <Heading level={2}>3. Thông tin của bạn</Heading>
            <Input id="bk-public-name" name="name" label="Tên của bạn" variant="secondary" isRequired value={name} onValueChange={setName} />
            <Input id="bk-public-phone" name="phone" kind="tel" label="Số điện thoại" variant="secondary" isRequired value={phone} onValueChange={setPhone} />
            <Input id="bk-public-email" name="email" kind="email" label="Email (không bắt buộc)" variant="secondary" value={email} onValueChange={setEmail} />
            <NumberField label="Số người" variant="secondary" minValue={1} maxValue={20} step={1} value={party} onValueChange={(v) => setParty(Number.isFinite(v) ? Math.max(1, v) : 1)} />
            <Input id="bk-public-note" name="note" label="Ghi chú (không bắt buộc)" variant="secondary" value={note} onValueChange={setNote} />
            {/* grammar gap: no Common honeypot field; the bot trap stays a raw, visually hidden input. */}
            <div aria-hidden className={HONEYPOT}><label>Website<input tabIndex={-1} autoComplete="off" value={website} onChange={(e) => setWebsite(e.target.value)} /></label></div>
          </div>
        </SurfaceCard>

        {result && !result.ok ? (
          <div className={STACK}>
            <Alert tone="negative" title={result.message} />
            {result.alternatives?.length ? (
              <div className={ROW}>
                {result.alternatives.map((a) => (
                  <Button key={a} size="sm" variant="outline" onPress={() => { setDate(localDate(Date.parse(a), tz)); setStart(a); setResult(null); }}>
                    {`${dayText(localDate(Date.parse(a), tz))} ${localHhmm(Date.parse(a), tz)}`}
                  </Button>
                ))}
              </div>
            ) : null}
          </div>
        ) : null}

        <Button type="submit" variant="primary" size="lg" width="fill" isPending={busy} isDisabled={busy || !start || !name.trim() || !phone.trim() || !svc}>Đặt lịch hẹn</Button>
        <Text size="xs" tone="muted">Bạn không cần tạo tài khoản. Cửa hàng sẽ nhắn xác nhận qua số điện thoại hoặc email bạn để lại.</Text>
      </div>
    </Form>
  );
};
