"use client";

import { useEffect, useRef, useState } from "react";
import { cn } from "@heroui/react";
import { addDays, localDate, localHhmm } from "@/lib/module-booking-availability";
import { dayText } from "@/lib/module-booking-copy";
import { FIELD, LABEL, vnd } from "./shared";

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

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
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
      <div role="status" className="rounded-2xl border border-separator bg-surface p-5">
        <h2 className="text-lg font-semibold">{result.state === "confirmed" ? "Đã xác nhận lịch hẹn" : "Đã gửi yêu cầu"}</h2>
        <p className="mt-2">{result.message}</p>
        <button type="button" className="mt-4 text-sm text-accent underline" onClick={() => { setResult(null); setStart(""); token.current = crypto.randomUUID(); }}>Đặt thêm một lịch khác</button>
      </div>
    );
  }

  return (
    <form className="flex flex-col gap-5" onSubmit={submit}>
      <fieldset className="flex flex-col gap-2">
        <legend className="mb-1 text-sm font-semibold">1. Chọn dịch vụ</legend>
        {services.length === 0 ? <p className="text-sm text-muted">Cửa hàng chưa mở nhận lịch qua trang này.</p> : null}
        {services.map((s) => (
          <label key={s.id} className={cn("flex cursor-pointer items-start gap-3 rounded-xl border p-3", serviceId === s.id ? "border-accent bg-accent/10" : "border-separator bg-surface")}>
            <input type="radio" name="service" className="mt-1" checked={serviceId === s.id} onChange={() => setServiceId(s.id)} />
            <span className="flex min-w-0 flex-col">
              <span className="font-medium">{s.name}</span>
              <span className="text-sm text-muted">{s.durationMin} phút{s.priceVnd ? ` · ${vnd(s.priceVnd)}` : ""}{s.description ? ` · ${s.description}` : ""}</span>
            </span>
          </label>
        ))}
      </fieldset>

      <fieldset className="flex flex-col gap-2">
        <legend className="mb-1 text-sm font-semibold">2. Chọn ngày và giờ</legend>
        <div className="flex gap-2 overflow-x-auto pb-1" role="group" aria-label="Chọn ngày">
          {days.map((d) => (
            <button key={d} type="button" onClick={() => setDate(d)} aria-pressed={date === d} className={cn("shrink-0 rounded-xl border px-3 py-2 text-sm", date === d ? "border-accent bg-accent/10 font-semibold" : "border-separator bg-surface")}>
              {dayText(d)}
            </button>
          ))}
        </div>
        <div className="grid grid-cols-3 gap-2 sm:grid-cols-4" role="group" aria-label="Chọn giờ">
          {times === null ? <p className="col-span-full text-sm text-muted">Đang tìm giờ trống...</p> : times.length === 0 ? <p className="col-span-full text-sm text-muted">Ngày này chưa còn giờ trống. Bạn chọn ngày khác nhé.</p> : times.map((t) => (
            <button key={t} type="button" onClick={() => setStart(t)} aria-pressed={start === t} className={cn("rounded-xl border py-2 text-sm", start === t ? "border-accent bg-accent text-accent-foreground font-semibold" : "border-separator bg-surface")}>
              {localHhmm(Date.parse(t), tz)}
            </button>
          ))}
        </div>
      </fieldset>

      <fieldset className="flex flex-col gap-3">
        <legend className="mb-1 text-sm font-semibold">3. Thông tin của bạn</legend>
        <label className={LABEL}>Tên của bạn<input className={FIELD} value={name} onChange={(e) => setName(e.target.value)} required autoComplete="name" /></label>
        <label className={LABEL}>Số điện thoại<input className={FIELD} value={phone} onChange={(e) => setPhone(e.target.value)} required inputMode="tel" autoComplete="tel" /></label>
        <label className={LABEL}>Email (không bắt buộc)<input className={FIELD} type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" /></label>
        <label className={LABEL}>Số người<input className={FIELD} type="number" min={1} max={20} value={party} onChange={(e) => setParty(Math.max(1, Number(e.target.value) || 1))} /></label>
        <label className={LABEL}>Ghi chú (không bắt buộc)<input className={FIELD} value={note} onChange={(e) => setNote(e.target.value)} /></label>
        <div aria-hidden className="absolute -left-[9999px] h-0 w-0 overflow-hidden"><label>Website<input tabIndex={-1} autoComplete="off" value={website} onChange={(e) => setWebsite(e.target.value)} /></label></div>
      </fieldset>

      {result && !result.ok ? (
        <div role="alert" className="rounded-xl border border-danger p-3 text-sm text-danger">
          {result.message}
          {result.alternatives?.length ? <div className="mt-2 flex flex-wrap gap-2">{result.alternatives.map((a) => <button key={a} type="button" className="rounded-lg border border-separator bg-surface px-2 py-1 text-foreground" onClick={() => { setDate(localDate(Date.parse(a), tz)); setStart(a); setResult(null); }}>{dayText(localDate(Date.parse(a), tz))} {localHhmm(Date.parse(a), tz)}</button>)}</div> : null}
        </div>
      ) : null}

      <button type="submit" disabled={busy || !start || !name.trim() || !phone.trim() || !svc} className="h-12 rounded-xl bg-accent px-4 font-semibold text-accent-foreground disabled:opacity-50">
        {busy ? "Đang gửi..." : "Đặt lịch hẹn"}
      </button>
      <p className="text-center text-xs text-muted">Bạn không cần tạo tài khoản. Cửa hàng sẽ nhắn xác nhận qua số điện thoại hoặc email bạn để lại.</p>
    </form>
  );
};
