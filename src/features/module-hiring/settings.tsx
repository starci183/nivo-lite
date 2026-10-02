"use client";

import { useState } from "react";
import { Alert, Button, Heading, Input, NumberField, Select, SurfaceCard, Switch, Text, Textarea } from "@starci/grammar/common";
import type { HiringWorkbenchData, MemberView } from "@/lib/module-hiring-queries";
import { saveAvailabilityAction, saveSettingsAction, type WindowInput } from "./actions";
import { FORM_CLASS_NAME, FORM_GRID_CLASS_NAME, SECTION_HEAD_CLASS_NAME } from "./classNames";
import { useRunner } from "./parts";

const DAYS: ReadonlyArray<{ readonly weekday: number; readonly label: string }> = [
  { weekday: 1, label: "Thứ hai" }, { weekday: 2, label: "Thứ ba" }, { weekday: 3, label: "Thứ tư" }, { weekday: 4, label: "Thứ năm" },
  { weekday: 5, label: "Thứ sáu" }, { weekday: 6, label: "Thứ bảy" }, { weekday: 0, label: "Chủ nhật" },
];
const fmt = (m: number): string => `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;
const toMin = (s: string): number | null => {
  const m = s.trim().match(/^(\d{1,2})(?:[:h](\d{2})?)?$/);
  if (!m) return null;
  const h = Number(m[1]);
  const mm = m[2] ? Number(m[2]) : 0;
  return h <= 24 && mm < 60 ? h * 60 + mm : null;
};
/** "09:00-12:00, 14:00-17:00" -> windows; null when a part is not a time range. */
const parseWindows = (weekday: number, text: string): Array<WindowInput> | null => {
  const out: Array<WindowInput> = [];
  for (const part of text.split(",").map((x) => x.trim()).filter(Boolean)) {
    const [a, b] = part.split(/\s*-\s*/);
    const s = toMin(a ?? "");
    const e = toMin(b ?? "");
    if (s === null || e === null || e <= s) return null;
    out.push({ weekday, start_min: s, end_min: e });
  }
  return out;
};
const dayText = (m: MemberView, weekday: number): string => m.windows.filter((w) => w.weekday === weekday).sort((a, b) => a.start_min - b.start_min).map((w) => `${fmt(w.start_min)}-${fmt(w.end_min)}`).join(", ");

const Availability = ({ members, meUserId }: { readonly members: ReadonlyArray<MemberView>; readonly meUserId: string }) => {
  const [who, setWho] = useState(members.find((m) => m.userId === meUserId)?.userId ?? members[0]?.userId ?? "");
  const member = members.find((m) => m.userId === who);
  const [texts, setTexts] = useState<Record<number, string>>(() => Object.fromEntries(DAYS.map((d) => [d.weekday, member ? dayText(member, d.weekday) : ""])));
  const [ok, setOk] = useState<string | null>(null);
  const { run, isPending, error } = useRunner();
  const pick = (id: string) => {
    setWho(id);
    const m = members.find((x) => x.userId === id);
    setTexts(Object.fromEntries(DAYS.map((d) => [d.weekday, m ? dayText(m, d.weekday) : ""])));
    setOk(null);
  };
  const bad = DAYS.filter((d) => parseWindows(d.weekday, texts[d.weekday] ?? "") === null);
  const save = () => {
    const windows = DAYS.flatMap((d) => parseWindows(d.weekday, texts[d.weekday] ?? "") ?? []);
    run(() => saveAvailabilityAction(who, windows), (r) => setOk(`Đã lưu ${r.saved} khung giờ.`));
  };
  if (!members.length) return <Text tone="muted">Chưa có thành viên.</Text>;
  return (
    <div className={FORM_CLASS_NAME}>
      <Select label="Thành viên" options={members.map((m) => ({ id: m.userId, label: m.name }))} value={who} onValueChange={(v) => pick(v ?? who)} />
      <div className={FORM_GRID_CLASS_NAME}>
        {DAYS.map((d) => (
          <Input
            key={`${who}-${d.weekday}`} id={`av-${d.weekday}`} name={`av_${d.weekday}`} label={d.label} variant="secondary" placeholder="09:00-12:00, 14:00-17:00"
            isError={bad.some((b) => b.weekday === d.weekday)} errorMessage={bad.some((b) => b.weekday === d.weekday) ? "Ghi giờ như 09:00-12:00" : undefined}
            value={texts[d.weekday] ?? ""} onValueChange={(v) => setTexts((p) => ({ ...p, [d.weekday]: v }))}
          />
        ))}
      </div>
      {error ? <Alert tone="negative" title="Chưa lưu được" description={error} urgency="assertive" /> : null}
      {ok ? <Alert tone="affirmative" title={ok} /> : null}
      <div><Button variant="secondary" isPending={isPending} isDisabled={isPending || bad.length > 0} onPress={save}>Lưu lịch rảnh</Button></div>
    </div>
  );
};

/** Props for {@link SettingsPanel}. */
export type SettingsPanelProps = { readonly data: HiringWorkbenchData };

/** Tab "Thiết lập": the public link, how long candidate files are kept, what NIVO does by itself, the consent text, and who is free to interview and when. */
export const SettingsPanel = ({ data }: SettingsPanelProps) => {
  const s = data.settings;
  const [slug, setSlug] = useState(s?.public_slug ?? "");
  const [days, setDays] = useState(s?.retention_days ?? 90);
  const [notify, setNotify] = useState(s?.notify_new_candidate ?? true);
  const [remind, setRemind] = useState(s?.remind_interview ?? true);
  const [close, setClose] = useState(s?.auto_close_when_filled ?? true);
  const [consent, setConsent] = useState(s?.apply_consent_text ?? "");
  const [tone, setTone] = useState(s?.ad_tone ?? "");
  const [ok, setOk] = useState<string | null>(null);
  const { run, isPending, error } = useRunner();
  const save = () => run(
    () => saveSettingsAction({ public_slug: slug, retention_days: days, notify_new_candidate: notify, remind_interview: remind, auto_close_when_filled: close, apply_consent_text: consent, ad_tone: tone }),
    () => setOk("Đã lưu thiết lập."),
  );
  return (
    <>
      <div className={SECTION_HEAD_CLASS_NAME}><Heading level={2}>Thiết lập</Heading></div>
      <SurfaceCard label="Trang ứng tuyển và hồ sơ ứng viên">
        <div className={FORM_CLASS_NAME}>
          <Input id="st-slug" name="slug" label="Tên trong đường dẫn" variant="secondary" value={slug} onValueChange={(v) => { setSlug(v); setOk(null); }} hint={`${data.origin}/j/${slug || "ten-cua-hang"}/ten-tin`} />
          <NumberField label="Giữ hồ sơ đã loại hoặc đã rút (ngày)" description="Sau số ngày này hồ sơ và file CV tự xóa. Từ 7 đến 730 ngày." minValue={7} maxValue={730} step={1} value={days} onValueChange={(v) => { setDays(Number.isFinite(v) ? v : 90); setOk(null); }} />
          <Textarea label="Lời đồng ý ứng viên thấy khi nộp hồ sơ" rows={3} maxLength={800} value={consent} onValueChange={(v) => { setConsent(v); setOk(null); }} />
          <Input id="st-tone" name="tone" label="Giọng điệu của tin đăng và thư mời" variant="secondary" value={tone} onValueChange={(v) => { setTone(v); setOk(null); }} />
          <Switch label="Báo khi có ứng viên mới" description="NIVO nhắn một dòng trong Office." isSelected={notify} onSelectedChange={(v) => { setNotify(v); setOk(null); }} />
          <Switch label="Nhắc phỏng vấn" description="Nhắc ứng viên và Office trước buổi hẹn 24 giờ." isSelected={remind} onSelectedChange={(v) => { setRemind(v); setOk(null); }} />
          <Switch label="Tự đóng tin khi đủ người" description="Đóng tin khi số người đã nhận việc bằng số cần tuyển." isSelected={close} onSelectedChange={(v) => { setClose(v); setOk(null); }} />
          {error ? <Alert tone="negative" title="Chưa lưu được" description={error} urgency="assertive" /> : null}
          {ok ? <Alert tone="affirmative" title={ok} /> : null}
          <div><Button variant="primary" isPending={isPending} isDisabled={isPending} onPress={save}>Lưu thiết lập</Button></div>
        </div>
      </SurfaceCard>
      <SurfaceCard label="Lịch rảnh để phỏng vấn">
        <Text size="sm" tone="muted">NIVO chỉ đề xuất giờ phỏng vấn trong các khung này (giờ Việt Nam). Người nào chưa khai báo thì dùng thứ hai đến thứ sáu, 9h-17h.</Text>
        <Availability members={data.members} meUserId={data.meUserId} />
      </SurfaceCard>
    </>
  );
};
