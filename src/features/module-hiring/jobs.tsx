"use client";

import { useMemo, useState } from "react";
import { Alert, Badge, Button, CheckboxGroup, Dialog, EmptyNotice, Heading, Input, NumberField, SegmentedControl, Select, SurfaceListCard, Switch, Text, Textarea } from "@starci/grammar/common";
import type { HiringWorkbenchData } from "@/lib/module-hiring-queries";
import {
  EMPLOYMENT_LABEL, JOB_STATUS_LABEL, PAY_UNIT_LABEL, fmtPay, validateJobDraft, fairnessMessage, type AdVariants, type JobQuestion, type JobRow, type JobStatus, type QuestionType,
} from "@/lib/module-hiring-shared";
import { generateAdAction, saveJobAction, setJobStatusAction } from "./actions";
import {
  AD_GRID_CLASS_NAME, CHIPS_CLASS_NAME, FORM_CLASS_NAME, FORM_GRID_CLASS_NAME, QUESTION_CLASS_NAME, QUOTE_CLASS_NAME, ROW_ACTIONS_CLASS_NAME, ROW_CLASS_NAME, ROW_MAIN_CLASS_NAME, SECTION_HEAD_CLASS_NAME,
} from "./classNames";
import { copyText, useRunner } from "./parts";

type Job = HiringWorkbenchData["jobs"][number];
const lines = (s: string): Array<string> => s.split("\n").map((x) => x.trim()).filter(Boolean);
const toNumber = (v: number): number | null => (Number.isFinite(v) ? v : null);
const QTYPES: ReadonlyArray<{ id: QuestionType; label: string }> = [{ id: "text", label: "Trả lời tự do" }, { id: "yesno", label: "Có / Không" }, { id: "number", label: "Con số" }, { id: "choice", label: "Chọn một" }];
const QUESTION_TEMPLATES: ReadonlyArray<JobQuestion> = [
  { id: "q1", text: "Bạn đã có kinh nghiệm ở vị trí tương tự chưa? Nếu có, nói ngắn gọn bạn đã làm gì.", type: "text", required: true },
  { id: "q2", text: "Bạn có thể bắt đầu đi làm từ khi nào?", type: "text", required: true },
];

type QDraft = { id: string; text: string; type: QuestionType; required: boolean; choices: string; expect: string };
const toDraft = (q: JobQuestion): QDraft => ({
  id: q.id, text: q.text, type: q.type, required: q.required, choices: (q.choices ?? []).join(", "),
  expect: q.expect === undefined ? "" : Array.isArray(q.expect) ? (q.expect as ReadonlyArray<string>).join(", ") : String(q.expect),
});
const fromDraft = (d: QDraft): JobQuestion => {
  const choices = d.type === "choice" ? d.choices.split(",").map((x) => x.trim()).filter(Boolean) : undefined;
  let expect: JobQuestion["expect"];
  if (d.type === "yesno" && (d.expect === "yes" || d.expect === "no")) expect = d.expect;
  else if (d.type === "number" && d.expect.trim() !== "" && Number.isFinite(Number(d.expect))) expect = Number(d.expect);
  else if (d.type === "choice" && d.expect.trim()) expect = d.expect.split(",").map((x) => x.trim()).filter(Boolean);
  return { id: d.id, text: d.text.trim(), type: d.type, required: d.required, ...(choices?.length ? { choices } : {}), ...(expect !== undefined ? { expect } : {}) };
};

/** Props for {@link JobEditor}. */
type EditorProps = { readonly job: JobRow | null; readonly onClose: () => void };

/** Create or edit a job. The fairness check runs while the owner types; the server runs it again on save. */
const JobEditor = ({ job, onClose }: EditorProps) => {
  const r = job?.requirements;
  const [title, setTitle] = useState(job?.title ?? "");
  const [position, setPosition] = useState(job?.position ?? "");
  const [type, setType] = useState<string>(job?.employment_type ?? "full_time");
  const [schedule, setSchedule] = useState(job?.schedule ?? "");
  const [payMin, setPayMin] = useState<number | null>(job?.pay_min_vnd ?? null);
  const [payMax, setPayMax] = useState<number | null>(job?.pay_max_vnd ?? null);
  const [unit, setUnit] = useState<string>(job?.pay_unit ?? "month");
  const [location, setLocation] = useState(job?.location ?? "");
  const [headcount, setHeadcount] = useState(job?.headcount ?? 1);
  const [description, setDescription] = useState(job?.description ?? "");
  const [skills, setSkills] = useState((r?.skills ?? []).join("\n"));
  const [years, setYears] = useState<number | null>(r?.experience_years ?? null);
  const [expNote, setExpNote] = useState(r?.experience_note ?? "");
  const [availability, setAvailability] = useState((r?.availability ?? []).join("\n"));
  const [must, setMust] = useState((r?.must_have ?? []).join("\n"));
  const [nice, setNice] = useState((r?.nice_to_have ?? []).join("\n"));
  const [questions, setQuestions] = useState<Array<QDraft>>((job?.questions.length ? job.questions : QUESTION_TEMPLATES).map(toDraft));
  const [channels, setChannels] = useState<Array<string>>([...(job?.channels ?? ["page", "chat"])]);
  const { run, isPending, error } = useRunner();

  const payload = useMemo(() => ({
    id: job?.id, title, position, employment_type: type, schedule, pay_min_vnd: payMin, pay_max_vnd: payMax, pay_unit: unit, location, headcount, description,
    requirements: { skills: lines(skills), experience_years: years, experience_note: expNote, availability: lines(availability), must_have: lines(must), nice_to_have: lines(nice) },
    questions: questions.filter((q) => q.text.trim()).map(fromDraft), channels,
  }), [job?.id, title, position, type, schedule, payMin, payMax, unit, location, headcount, description, skills, years, expNote, availability, must, nice, questions, channels]);

  const violations = useMemo(() => validateJobDraft({
    title, position, description, schedule, requirements: { skills: lines(skills), experience_years: years, experience_note: expNote, availability: lines(availability), must_have: lines(must), nice_to_have: lines(nice) },
    questions: questions.filter((q) => q.text.trim()).map(fromDraft),
  }), [title, position, description, schedule, skills, years, expNote, availability, must, nice, questions]);

  const setQ = (i: number, patch: Partial<QDraft>) => setQuestions((p) => p.map((q, k) => (k === i ? { ...q, ...patch } : q)));
  const save = () => run(() => saveJobAction(payload), () => onClose());

  return (
    <Dialog
      isOpen onOpenChange={(open) => { if (!open) onClose(); }} size="lg" title={job ? "Sửa tin tuyển dụng" : "Tin tuyển dụng mới"} closeLabel="Đóng"
      description="Viết theo kỹ năng, kinh nghiệm và lịch làm việc. NIVO không nhận yêu cầu về giới tính, tuổi, tôn giáo, dân tộc, hôn nhân, thai sản, khuyết tật, quê quán hay ngoại hình."
      footer={(close) => (
        <>
          <Button variant="tertiary" onPress={close}>Hủy</Button>
          <Button variant="primary" isPending={isPending} isDisabled={isPending || title.trim().length < 3 || violations.length > 0} onPress={save}>Lưu tin</Button>
        </>
      )}
    >
      <div className={FORM_CLASS_NAME}>
        {violations.length > 0 ? <Alert tone="cautionary" title="Có yêu cầu có thể phân biệt đối xử" description={fairnessMessage(violations)} urgency="assertive" /> : null}
        {error ? <Alert tone="negative" title="Chưa lưu được" description={error} urgency="assertive" /> : null}
        <div className={FORM_GRID_CLASS_NAME}>
          <Input id="job-title" name="title" label="Tên tin" placeholder="Ví dụ: Nhân viên phục vụ ca tối" variant="secondary" isRequired value={title} onValueChange={setTitle} />
          <Input id="job-position" name="position" label="Vị trí" variant="secondary" value={position} onValueChange={setPosition} />
          <SegmentedControl label="Hình thức" options={[{ value: "full_time", label: EMPLOYMENT_LABEL.full_time }, { value: "part_time", label: EMPLOYMENT_LABEL.part_time }]} value={type} onValueChange={setType} />
          <Input id="job-schedule" name="schedule" label="Lịch làm" placeholder="Ví dụ: Ca tối 17h-22h, 5 buổi/tuần" variant="secondary" value={schedule} onValueChange={setSchedule} />
          <NumberField label="Lương từ (đồng)" minValue={0} step={500000} formatOptions={{ maximumFractionDigits: 0 }} value={payMin ?? undefined} onValueChange={(v) => setPayMin(toNumber(v))} />
          <NumberField label="Lương đến (đồng)" minValue={0} step={500000} formatOptions={{ maximumFractionDigits: 0 }} value={payMax ?? undefined} onValueChange={(v) => setPayMax(toNumber(v))} />
          <Select label="Tính lương theo" options={(["month", "hour", "shift"] as const).map((u) => ({ id: u, label: PAY_UNIT_LABEL[u] }))} value={unit} onValueChange={(v) => setUnit(v ?? "month")} />
          <Input id="job-location" name="location" label="Nơi làm việc" variant="secondary" value={location} onValueChange={setLocation} />
          <NumberField label="Cần tuyển (người)" minValue={1} maxValue={500} step={1} value={headcount} onValueChange={(v) => setHeadcount(Number.isFinite(v) ? v : 1)} />
        </div>
        <Textarea label="Mô tả công việc" rows={4} maxLength={6000} value={description} onValueChange={setDescription} />
        <Heading level={3}>Yêu cầu (dùng để sàng lọc)</Heading>
        <div className={FORM_GRID_CLASS_NAME}>
          <Textarea label="Kỹ năng" description="Mỗi dòng một kỹ năng." rows={3} value={skills} onValueChange={setSkills} />
          <Textarea label="Lịch có thể làm" description="Mỗi dòng một lựa chọn, ví dụ: Ca tối, Cuối tuần." rows={3} value={availability} onValueChange={setAvailability} />
          <Textarea label="Bắt buộc khác" description="Mỗi dòng một yêu cầu, ví dụ: Biết dùng máy POS." rows={3} value={must} onValueChange={setMust} />
          <Textarea label="Điểm cộng" description="Mỗi dòng một điểm." rows={3} value={nice} onValueChange={setNice} />
          <NumberField label="Kinh nghiệm tối thiểu (năm)" minValue={0} maxValue={50} step={1} value={years ?? undefined} onValueChange={(v) => setYears(toNumber(v))} />
          <Input id="job-exp-note" name="experience_note" label="Ghi chú kinh nghiệm" variant="secondary" value={expNote} onValueChange={setExpNote} />
        </div>
        <Heading level={3}>Câu hỏi cho ứng viên</Heading>
        <Text size="sm" tone="muted">Ứng viên trả lời khi nộp hồ sơ hoặc chat. Đặt "đáp án mong muốn" nếu muốn NIVO đối chiếu (ví dụ: Có thể làm cuối tuần? mong muốn Có).</Text>
        {questions.map((q, i) => (
          <div key={q.id} className={QUESTION_CLASS_NAME}>
            <Input id={`job-q-${q.id}`} name={`q_${q.id}`} label={`Câu hỏi ${i + 1}`} variant="secondary" value={q.text} onValueChange={(v) => setQ(i, { text: v })} />
            <div className={FORM_GRID_CLASS_NAME}>
              <Select label="Kiểu trả lời" options={QTYPES.map((t) => ({ id: t.id, label: t.label }))} value={q.type} onValueChange={(v) => setQ(i, { type: (v ?? "text") as QuestionType, expect: "" })} />
              {q.type === "yesno" ? (
                <Select label="Đáp án mong muốn" options={[{ id: "", label: "Không chấm điểm" }, { id: "yes", label: "Có" }, { id: "no", label: "Không" }]} value={q.expect} onValueChange={(v) => setQ(i, { expect: v ?? "" })} />
              ) : q.type === "number" ? (
                <Input id={`job-qe-${q.id}`} name={`qe_${q.id}`} label="Tối thiểu (để trống: không chấm)" variant="secondary" value={q.expect} onValueChange={(v) => setQ(i, { expect: v })} />
              ) : q.type === "choice" ? (
                <Input id={`job-qc-${q.id}`} name={`qc_${q.id}`} label="Các lựa chọn (cách nhau bằng dấu phẩy)" variant="secondary" value={q.choices} onValueChange={(v) => setQ(i, { choices: v })} />
              ) : null}
            </div>
            {q.type === "choice" ? <Input id={`job-qx-${q.id}`} name={`qx_${q.id}`} label="Lựa chọn được chấp nhận (để trống: không chấm)" variant="secondary" value={q.expect} onValueChange={(v) => setQ(i, { expect: v })} /> : null}
            <div className={ROW_ACTIONS_CLASS_NAME}>
              <Switch label="Bắt buộc trả lời" isSelected={q.required} onSelectedChange={(v) => setQ(i, { required: v })} />
              <Button variant="ghost" size="sm" onPress={() => setQuestions((p) => p.filter((_, k) => k !== i))}>Xóa câu hỏi</Button>
            </div>
          </div>
        ))}
        {questions.length < 12 ? <div><Button variant="secondary" size="sm" onPress={() => setQuestions((p) => [...p, { id: `q${Date.now().toString(36).slice(-5)}`, text: "", type: "text", required: false, choices: "", expect: "" }])}>Thêm câu hỏi</Button></div> : null}
        <CheckboxGroup label="Nhận hồ sơ qua" orientation="horizontal" options={[{ value: "page", label: "Trang ứng tuyển" }, { value: "chat", label: "Chatbot của cửa hàng" }]} value={channels} onValueChange={setChannels} />
      </div>
    </Dialog>
  );
};

/** The three ready-to-paste variants of a job ad, with the time OpenClaw took. */
const AdDialog = ({ job, onClose }: { readonly job: Job; readonly onClose: () => void }) => {
  const [ads, setAds] = useState<AdVariants | null>(job.ad_variants);
  const [meta, setMeta] = useState<string | null>(null);
  const [copied, setCopied] = useState<string | null>(null);
  const { run, isPending, error } = useRunner();
  const generate = () => run(() => generateAdAction(job.id), (d) => {
    setAds(d.ads);
    const eng = d.timings.total_ms ?? d.timings.run_ms ?? null;
    setMeta(`OpenClaw soạn trong ${(d.ads.ms / 1000).toFixed(1)} giây${eng ? ` (engine ${(eng / 1000).toFixed(1)} giây)` : ""}${d.attempts > 1 ? ", đã viết lại 1 lần để bỏ chi tiết không công bằng" : ""}${d.sanitised ? ", đã loại các dòng không phù hợp" : ""}.`);
  });
  const copy = async (key: string, text: string) => setCopied((await copyText(text)) ? key : null);
  const block = (key: "facebook" | "zalo" | "topcv", label: string) =>
    ads ? (
      <div key={key} className={FORM_CLASS_NAME}>
        <div className={SECTION_HEAD_CLASS_NAME}>
          <Heading level={3}>{label}</Heading>
          <Button variant="secondary" size="sm" onPress={() => void copy(key, ads[key])}>{copied === key ? "Đã chép" : "Chép nội dung"}</Button>
        </div>
        <pre className={QUOTE_CLASS_NAME}>{ads[key]}</pre>
      </div>
    ) : null;
  return (
    <Dialog
      isOpen onOpenChange={(open) => { if (!open) onClose(); }} size="lg" title={`Tin đăng: ${job.title}`} closeLabel="Đóng"
      description="OpenClaw soạn từ thông tin của tin. Bạn tự đăng lên nhóm Facebook, Zalo hoặc trang tuyển dụng; đăng tự động đang Sắp có."
      footer={(close) => (<><Button variant="tertiary" onPress={close}>Đóng</Button><Button variant="primary" isPending={isPending} isDisabled={isPending} onPress={generate}>{ads ? "Soạn lại" : "Soạn tin đăng"}</Button></>)}
    >
      <div className={AD_GRID_CLASS_NAME}>
        {error ? <Alert tone="negative" title="Chưa soạn được tin" description={error} urgency="assertive" /> : null}
        {isPending ? <Text tone="muted" live="polite">OpenClaw đang viết, thường mất vài chục giây...</Text> : null}
        {meta ? <Text size="sm" tone="muted">{meta}</Text> : null}
        {!ads && !isPending ? <EmptyNotice message="Chưa có tin đăng" description="Bấm Soạn tin đăng để có bản dùng cho nhóm Facebook, Zalo và kiểu TopCV." /> : null}
        {block("facebook", "Nhóm Facebook")}
        {block("zalo", "Nhóm Zalo")}
        {block("topcv", "Kiểu TopCV")}
        {job.publicUrl ? <Text size="sm" tone="muted">{`Đường dẫn ứng tuyển: ${job.publicUrl}`}</Text> : null}
      </div>
    </Dialog>
  );
};

const NEXT_STATUS: Readonly<Record<JobStatus, ReadonlyArray<{ to: JobStatus; label: string }>>> = {
  draft: [{ to: "open", label: "Mở tin" }],
  open: [{ to: "paused", label: "Tạm dừng" }, { to: "closed", label: "Đóng tin" }],
  paused: [{ to: "open", label: "Mở lại" }, { to: "closed", label: "Đóng tin" }],
  closed: [{ to: "open", label: "Mở lại" }],
};

/** Props for {@link JobsPanel}. */
export type JobsPanelProps = { readonly data: HiringWorkbenchData; readonly onOpenPipeline: (jobId: string) => void };

/** Tab "Tin tuyển dụng": the jobs, their link, their numbers and what the owner can do with each. */
export const JobsPanel = ({ data, onOpenPipeline }: JobsPanelProps) => {
  const [editing, setEditing] = useState<JobRow | "new" | null>(null);
  const [ad, setAd] = useState<Job | null>(null);
  const [copied, setCopied] = useState<string | null>(null);
  const { run, isPending, error } = useRunner();
  const counts = useMemo(() => {
    const m = new Map<string, { all: number; hired: number; fresh: number }>();
    for (const c of data.candidates) {
      const x = m.get(c.job_id) ?? { all: 0, hired: 0, fresh: 0 };
      x.all += 1;
      if (c.stage === "hired") x.hired += 1;
      if (c.stage === "applied") x.fresh += 1;
      m.set(c.job_id, x);
    }
    return m;
  }, [data.candidates]);

  return (
    <>
      <div className={SECTION_HEAD_CLASS_NAME}>
        <Heading level={2}>Tin tuyển dụng</Heading>
        <Button variant="primary" onPress={() => setEditing("new")}>Tạo tin mới</Button>
      </div>
      {error ? <Alert tone="negative" title="Chưa làm được" description={error} urgency="assertive" /> : null}
      <SurfaceListCard
        ariaLabel="Danh sách tin tuyển dụng" fact={`${data.jobs.length} tin`}
        empty={<EmptyNotice message="Chưa có tin tuyển dụng" description="Tạo tin đầu tiên: nêu vị trí, lương, lịch làm và yêu cầu. NIVO sẽ soạn tin đăng và nhận hồ sơ giúp bạn." actionLabel="Tạo tin mới" onAction={() => setEditing("new")} />}
      >
        {data.jobs.map((j) => {
          const n = counts.get(j.id) ?? { all: 0, hired: 0, fresh: 0 };
          return (
            <li key={j.id} className={ROW_CLASS_NAME}>
              <div className={ROW_MAIN_CLASS_NAME}>
                <div className={CHIPS_CLASS_NAME}>
                  <Text as="span" weight="semibold">{j.title}</Text>
                  <Badge tone={j.status === "open" ? "success" : j.status === "draft" ? "neutral" : j.status === "paused" ? "warning" : "danger"} isDot>{JOB_STATUS_LABEL[j.status]}</Badge>
                </div>
                <Text size="sm" tone="muted">{[EMPLOYMENT_LABEL[j.employment_type], fmtPay(j.pay_min_vnd, j.pay_max_vnd, j.pay_unit), j.location, j.schedule].filter(Boolean).join(" · ")}</Text>
                <Text size="sm">{`${n.all} ứng viên${n.fresh ? `, ${n.fresh} mới` : ""} · đã nhận ${n.hired}/${j.headcount}`}</Text>
                {j.publicUrl && j.status !== "draft" ? <Text size="xs" tone="muted">{j.publicUrl}</Text> : null}
              </div>
              <div className={ROW_ACTIONS_CLASS_NAME}>
                {j.publicUrl && j.status === "open" ? (
                  <Button variant="tertiary" size="sm" onPress={() => void copyText(j.publicUrl!).then((ok) => setCopied(ok ? j.id : null))}>{copied === j.id ? "Đã chép link" : "Chép link"}</Button>
                ) : null}
                <Button variant="tertiary" size="sm" onPress={() => onOpenPipeline(j.id)}>Xem ứng viên</Button>
                <Button variant="secondary" size="sm" onPress={() => setAd(j)}>Soạn tin đăng</Button>
                <Button variant="secondary" size="sm" onPress={() => setEditing(j)}>Sửa</Button>
                {NEXT_STATUS[j.status].map((s) => (
                  <Button key={s.to} variant={s.to === "open" ? "primary" : "ghost"} size="sm" isDisabled={isPending} onPress={() => run(() => setJobStatusAction(j.id, s.to))}>{s.label}</Button>
                ))}
              </div>
            </li>
          );
        })}
      </SurfaceListCard>
      {editing ? <JobEditor key={editing === "new" ? "new" : editing.id} job={editing === "new" ? null : editing} onClose={() => setEditing(null)} /> : null}
      {ad ? <AdDialog key={ad.id} job={ad} onClose={() => setAd(null)} /> : null}
    </>
  );
};
