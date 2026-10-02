"use client";

import { useRef, useState } from "react";
import { Alert, Button, Checkbox, CheckboxGroup, FileDropzone, Input, RadioGroup, Text, Textarea } from "@starci/grammar/common";
import type { JobQuestion, JobRequirements } from "@/lib/module-hiring-shared";
import { FORM_CLASS_NAME, HONEYPOT_CLASS_NAME } from "./classNames";

/** Props for {@link ApplyForm}. */
export type ApplyFormProps = {
  readonly ws: string;
  readonly job: string;
  readonly questions: ReadonlyArray<JobQuestion>;
  readonly availability: JobRequirements["availability"];
  readonly consentText: string;
};

const MAX_CV = 5 * 1024 * 1024;

/** The public apply form: name, phone, optional email and CV, availability, the job's own questions, and the consent. Posts to /api/hiring/apply. */
export const ApplyForm = ({ ws, job, questions, availability, consentText }: ApplyFormProps) => {
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [avail, setAvail] = useState<Array<string>>([]);
  const [availText, setAvailText] = useState("");
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [cv, setCv] = useState<File | null>(null);
  const [consent, setConsent] = useState(false);
  const [state, setState] = useState<{ kind: "idle" | "sending" | "done" | "error"; message?: string }>({ kind: "idle" });
  const bot = useRef<HTMLInputElement>(null);

  const cvError = cv && cv.size > MAX_CV ? "File CV lớn quá 5 MB. Hãy nén hoặc gửi bản nhẹ hơn." : undefined;
  const setAnswer = (id: string, v: string) => setAnswers((p) => ({ ...p, [id]: v }));

  const submit = async () => {
    if (state.kind === "sending" || cvError) return;
    setState({ kind: "sending" });
    const f = new FormData();
    f.set("ws", ws);
    f.set("job", job);
    f.set("name", name);
    f.set("phone", phone);
    f.set("email", email);
    f.set("availability", availability.length ? avail.join(", ") : availText);
    f.set("website", bot.current?.value ?? "");
    f.set("consent", consent ? "1" : "0");
    for (const q of questions) f.set(`q_${q.id}`, answers[q.id] ?? "");
    if (cv) f.set("cv", cv);
    try {
      const res = await fetch("/api/hiring/apply", { method: "POST", body: f });
      const body = (await res.json().catch(() => ({}))) as { ok?: boolean; message?: string };
      setState(res.ok && body.ok ? { kind: "done", message: body.message } : { kind: "error", message: body.message ?? "Có lỗi khi nộp hồ sơ, vui lòng thử lại." });
    } catch {
      setState({ kind: "error", message: "Không kết nối được. Kiểm tra mạng rồi thử lại." });
    }
  };

  if (state.kind === "done") return <Alert tone="affirmative" title={state.message ?? "Đã nhận hồ sơ của bạn."} />;
  const busy = state.kind === "sending";
  return (
    <form className={FORM_CLASS_NAME} onSubmit={(e) => { e.preventDefault(); void submit(); }} noValidate>
      <Input id="apply-name" name="name" label="Họ và tên" variant="secondary" isRequired isDisabled={busy} value={name} onValueChange={setName} />
      <Input id="apply-phone" name="phone" label="Số điện thoại" hint="Ví dụ: 0901234567" variant="secondary" isRequired isDisabled={busy} value={phone} onValueChange={setPhone} />
      <Input id="apply-email" name="email" kind="email" label="Email (không bắt buộc)" variant="secondary" isDisabled={busy} value={email} onValueChange={setEmail} />
      {availability.length ? (
        <CheckboxGroup label="Bạn có thể làm vào" name="availability" options={availability.map((a) => ({ value: a, label: a }))} value={avail} isDisabled={busy} onValueChange={setAvail} />
      ) : (
        <Input id="apply-availability" name="availability" label="Lịch bạn có thể làm (không bắt buộc)" variant="secondary" isDisabled={busy} value={availText} onValueChange={setAvailText} />
      )}
      {questions.map((q) => {
        const common = { label: q.text, isRequired: q.required, isDisabled: busy };
        if (q.type === "yesno") return <RadioGroup key={q.id} {...common} name={`q_${q.id}`} orientation="horizontal" options={[{ value: "Có", label: "Có" }, { value: "Không", label: "Không" }]} value={answers[q.id] ?? null} onValueChange={(v) => setAnswer(q.id, v)} />;
        if (q.type === "choice") return <RadioGroup key={q.id} {...common} name={`q_${q.id}`} options={(q.choices ?? []).map((c) => ({ value: c, label: c }))} value={answers[q.id] ?? null} onValueChange={(v) => setAnswer(q.id, v)} />;
        if (q.type === "number") return <Input key={q.id} id={`apply-q-${q.id}`} name={`q_${q.id}`} {...common} variant="secondary" value={answers[q.id] ?? ""} onValueChange={(v) => setAnswer(q.id, v)} />;
        return <Textarea key={q.id} {...common} name={`q_${q.id}`} rows={3} maxLength={1000} value={answers[q.id] ?? ""} onValueChange={(v) => setAnswer(q.id, v)} />;
      })}
      <FileDropzone
        label="CV (không bắt buộc)" name="cv" accept=".pdf,.doc,.docx,.jpg,.jpeg,.png" description="PDF, Word hoặc ảnh, tối đa 5 MB." isDisabled={busy}
        prompt="Bấm để chọn file hoặc kéo thả vào đây" errorMessage={cvError} onFilesChange={(files) => setCv(files[0] ?? null)}
      />
      <div className={HONEYPOT_CLASS_NAME} aria-hidden="true">
        <label>Website<input ref={bot} type="text" name="website" tabIndex={-1} autoComplete="off" /></label>
      </div>
      <Checkbox name="consent" label="Tôi đồng ý" description={consentText} isRequired isSelected={consent} isDisabled={busy} onSelectedChange={setConsent} />
      {state.kind === "error" ? <Alert tone="negative" title={state.message ?? "Có lỗi, vui lòng thử lại."} urgency="assertive" /> : null}
      <Button type="submit" variant="primary" isPending={busy} isDisabled={busy || !consent || !name.trim() || !(phone.trim() || email.trim()) || Boolean(cvError)}>Nộp hồ sơ</Button>
      <Text size="xs" tone="muted">Hồ sơ chỉ dùng cho việc tuyển dụng này. Bạn có thể yêu cầu xóa bất cứ lúc nào bằng cách liên hệ doanh nghiệp.</Text>
    </form>
  );
};
