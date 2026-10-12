"use client";

import { useEffect, useState } from "react";
import { Alert, AlertDialog, Badge, Button, Dialog, Drawer, Heading, Image, Input, List, ListItem, MediaFrame, NumberField, SegmentedControl, Select, SurfaceCard, Text, Textarea } from "@starci/grammar/common";
import type { HiringWorkbenchData } from "@/lib/module-hiring-queries";
import {
  INTERVIEW_STATUS_LABEL, OFFER_STATUS_LABEL, SCORE_LABEL, STAGE_LABEL, fmtPay, fmtVnDateTime, type CandidateRow, type Stage,
} from "@/lib/module-hiring-shared";
import {
  cancelOfferAction, deleteCandidateAction, loadCandidateDetailAction, moveCandidateAction, requestInterviewAction, requestOfferAction, rescreenAction, saveNotesAction,
  type CandidateDetail, type ItemOutcome,
} from "./actions";
import {
  CHIPS_CLASS_NAME, CV_FRAME_CLASS_NAME, FORM_CLASS_NAME, FORM_GRID_CLASS_NAME, PAIR_CLASS_NAME, PRE_WRAP_CLASS_NAME, REASON_CLASS_NAME, REASONS_CLASS_NAME, ROW_ACTIONS_CLASS_NAME, SCORE_CLASS_NAME,
} from "./classNames";
import { SOURCE_LABEL, scoreTone, stageTone, useRunner } from "./parts";

type Data = HiringWorkbenchData;

const InterviewDialog = ({ c, data, onClose }: { readonly c: CandidateRow; readonly data: Data; readonly onClose: () => void }) => {
  const job = data.jobs.find((j) => j.id === c.job_id);
  const [who, setWho] = useState<string>(data.members.find((m) => m.userId === data.meUserId)?.userId ?? data.members[0]?.userId ?? "");
  const [mode, setMode] = useState<string>("in_person");
  const [location, setLocation] = useState(job?.location ?? "");
  const [duration, setDuration] = useState(30);
  const [result, setResult] = useState<ItemOutcome | null>(null);
  const { run, isPending, error } = useRunner();
  const send = () => run(() => requestInterviewAction(c.id, { interviewerUserId: who || null, mode: mode === "online" ? "online" : "in_person", location, durationMin: duration }), setResult);
  return (
    <Dialog
      isOpen onOpenChange={(o) => { if (!o) onClose(); }} size="md" title={`Xếp lịch phỏng vấn: ${c.name}`} closeLabel="Đóng"
      description="NIVO đề xuất 3 giờ từ lịch rảnh của người phỏng vấn và gửi cho ứng viên chọn. Ứng viên chọn giờ nào thì lịch được xác nhận."
      footer={(close) => (<><Button variant="tertiary" onPress={close}>{result ? "Xong" : "Hủy"}</Button>{result ? null : <Button variant="primary" isPending={isPending} isDisabled={isPending || (mode === "online" && !location.trim())} onPress={send}>Xếp lịch và gửi</Button>}</>)}
    >
      <div className={FORM_CLASS_NAME}>
        {error ? <Alert tone="negative" title="Chưa xếp được lịch" description={error} urgency="assertive" /> : null}
        {result ? (
          <Alert tone={result.status === "done" ? "affirmative" : "informative"} title={result.status === "done" ? "Đã xếp lịch" : "Đang chờ bạn duyệt"} description={result.summary} />
        ) : (
          <>
            <Select label="Người phỏng vấn" variant="secondary" options={data.members.map((m) => ({ id: m.userId, label: `${m.name}${m.windows.length ? "" : " (chưa khai báo lịch rảnh: dùng 9h-17h)"}` }))} value={who} onValueChange={(v) => setWho(v ?? "")} />
            <SegmentedControl label="Hình thức" options={[{ value: "in_person", label: "Trực tiếp" }, { value: "online", label: "Online" }]} value={mode} onValueChange={setMode} />
            <Input id="iv-loc" name="location" label={mode === "online" ? "Đường dẫn cuộc họp" : "Địa điểm"} variant="secondary" value={location} onValueChange={setLocation} />
            <NumberField label="Thời lượng (phút)" variant="secondary" minValue={15} maxValue={180} step={15} value={duration} onValueChange={(v) => setDuration(Number.isFinite(v) ? v : 30)} />
          </>
        )}
      </div>
    </Dialog>
  );
};

const OfferDialog = ({ c, data, onClose }: { readonly c: CandidateRow; readonly data: Data; readonly onClose: () => void }) => {
  const job = data.jobs.find((j) => j.id === c.job_id);
  const [title, setTitle] = useState(job?.title ?? "");
  const [pay, setPay] = useState(job ? fmtPay(job.pay_min_vnd, job.pay_max_vnd, job.pay_unit) : "");
  const [start, setStart] = useState("");
  const [probation, setProbation] = useState("");
  const [note, setNote] = useState("");
  const [result, setResult] = useState<ItemOutcome | null>(null);
  const { run, isPending, error } = useRunner();
  const send = () => run(() => requestOfferAction(c.id, { title, pay, start_date: start, probation, note }), setResult);
  return (
    <Dialog
      isOpen onOpenChange={(o) => { if (!o) onClose(); }} size="md" title={`Thư mời nhận việc: ${c.name}`} closeLabel="Đóng"
      description="OpenClaw soạn thư từ các điều khoản bên dưới. Thư chỉ được gửi sau khi bạn duyệt trong Quyết định."
      footer={(close) => (<><Button variant="tertiary" onPress={close}>{result ? "Xong" : "Hủy"}</Button>{result ? null : <Button variant="primary" isPending={isPending} isDisabled={isPending || !pay.trim()} onPress={send}>Soạn thư mời</Button>}</>)}
    >
      <div className={FORM_CLASS_NAME}>
        {error ? <Alert tone="negative" title="Chưa soạn được thư mời" description={error} urgency="assertive" /> : null}
        {result ? (
          <Alert tone={result.status === "waiting_decision" ? "cautionary" : "affirmative"} title={result.status === "waiting_decision" ? "Thư mời đang chờ bạn duyệt" : "Đã xử lý"} description={`${result.summary}${result.status === "waiting_decision" ? " Mở Quyết định để xem, sửa và duyệt thư." : ""}`} />
        ) : (
          <>
            <Input id="of-title" name="title" label="Vị trí" variant="secondary" value={title} onValueChange={setTitle} />
            <Input id="of-pay" name="pay" label="Thu nhập" variant="secondary" isRequired value={pay} onValueChange={setPay} hint="Ví dụ: 8.000.000 đ/tháng" />
            <div className={FORM_GRID_CLASS_NAME}>
              <Input id="of-start" name="start_date" label="Ngày bắt đầu" variant="secondary" value={start} onValueChange={setStart} />
              <Input id="of-prob" name="probation" label="Thử việc" variant="secondary" value={probation} onValueChange={setProbation} />
            </div>
            <Textarea label="Ghi chú thêm" variant="secondary" rows={2} value={note} onValueChange={setNote} />
          </>
        )}
      </div>
    </Dialog>
  );
};

/** Props for {@link CandidateDrawer}. */
export type CandidateDrawerProps = { readonly c: CandidateRow | null; readonly data: Data; readonly onClose: () => void };

/** One candidate: contact, CV preview, answers, score and reasons, notes, timeline, and the next steps (interview, offer, reject, delete). */
export const CandidateDrawer = ({ c, data, onClose }: CandidateDrawerProps) => {
  const [detail, setDetail] = useState<CandidateDetail | null>(null);
  const [notes, setNotes] = useState("");
  const [showCv, setShowCv] = useState(false);
  const [dialog, setDialog] = useState<"interview" | "offer" | "reject" | "delete" | null>(null);
  const [reason, setReason] = useState("");
  const [msg, setMsg] = useState<string | null>(null);
  const { run, isPending, error, setError } = useRunner();
  const id = c?.id ?? null;

  useEffect(() => {
    setDetail(null);
    setShowCv(false);
    setMsg(null);
    setError(null);
    setNotes(c?.notes ?? "");
    if (!id) return;
    let live = true;
    void loadCandidateDetailAction(id).then((r) => { if (live && r.ok) setDetail(r.data); });
    return () => { live = false; };
    // the data refresh after an action must not wipe the notes being typed: re-run only when another candidate opens
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  const job = c ? data.jobs.find((j) => j.id === c.job_id) : null;
  const interviews = c ? data.interviews.filter((i) => i.candidate_id === c.id) : [];
  const offers = c ? data.offers.filter((o) => o.candidate_id === c.id) : [];
  const closed = c ? ["rejected", "withdrawn", "hired"].includes(c.stage) : true;
  const openInterview = interviews.some((i) => i.status === "proposed" || i.status === "confirmed");
  const openOffer = offers.some((o) => ["draft", "waiting", "sent"].includes(o.status));

  return (
    <>
      <Drawer isOpen={c !== null} onOpenChange={(o) => { if (!o) onClose(); }} title={c?.name ?? "Ứng viên"} description={c ? `${job?.title ?? ""} · ${SOURCE_LABEL[c.source] ?? c.source}` : undefined} closeLabel="Đóng" placement="right">
        {c ? (
          <div className={FORM_CLASS_NAME}>
            {error ? <Alert tone="negative" title="Chưa làm được" description={error} dismissLabel="Ẩn" onDismiss={() => setError(null)} urgency="assertive" /> : null}
            {msg ? <Alert tone="informative" title={msg} dismissLabel="Ẩn" onDismiss={() => setMsg(null)} /> : null}
            <div className={CHIPS_CLASS_NAME}>
              <Badge tone={stageTone(c.stage)} isDot>{STAGE_LABEL[c.stage]}</Badge>
              {c.phone ? <Text as="span" size="sm">{c.phone}</Text> : null}
              {c.email ? <Text as="span" size="sm">{c.email}</Text> : null}
            </div>
            <div className={ROW_ACTIONS_CLASS_NAME}>
              <Button variant="primary" size="sm" isDisabled={closed || openInterview} onPress={() => setDialog("interview")}>Xếp lịch phỏng vấn</Button>
              <Button variant="secondary" size="sm" isDisabled={closed || openOffer} onPress={() => setDialog("offer")}>Soạn thư mời</Button>
              {c.stage === "applied" || c.stage === "screening" ? <Button variant="tertiary" size="sm" isDisabled={isPending} onPress={() => run(() => moveCandidateAction(c.id, "shortlisted" as Stage))}>Vào danh sách</Button> : null}
              <Button variant="danger-soft" size="sm" isDisabled={closed} onPress={() => { setReason(""); setDialog("reject"); }}>Loại</Button>
            </div>

            <Heading level={3}>Điểm sàng lọc (chỉ để tham khảo)</Heading>
            {c.score !== null ? (
              <>
                <div className={SCORE_CLASS_NAME}>
                  <Text size="metric-lead" weight="semibold">{`${c.score}/100`}</Text>
                  <Badge tone={scoreTone(c.score_label)}>{c.score_label ? SCORE_LABEL[c.score_label] : ""}</Badge>
                </div>
                {c.score_summary ? (
                  <SurfaceCard depth="nested" ariaLabel="Tóm tắt sàng lọc">
                    <div className={PRE_WRAP_CLASS_NAME}><Text as="p" size="sm">{c.score_summary}</Text></div>
                  </SurfaceCard>
                ) : null}
                <List className={REASONS_CLASS_NAME}>
                  {c.score_reasons.map((r, i) => (
                    <ListItem key={`${r.criterion}-${i}`} className={REASON_CLASS_NAME}>
                      <Badge tone={r.status === "met" ? "success" : r.status === "unmet" ? "danger" : "neutral"}>{r.status === "met" ? "Khớp" : r.status === "unmet" ? "Chưa khớp" : "Chưa rõ"}</Badge>
                      <div className={PAIR_CLASS_NAME}><Text size="sm" weight="medium">{r.criterion}</Text><Text size="xs" tone="muted">{r.note}</Text></div>
                    </ListItem>
                  ))}
                </List>
                <Text size="xs" tone="muted">NIVO chỉ đối chiếu với yêu cầu đã viết của công việc. Không dùng giới tính, tuổi hay các yếu tố bị cấm. Điểm không loại ai: loại là quyết định của bạn.</Text>
              </>
            ) : <Text tone="muted">Chưa sàng lọc. Hồ sơ mới sẽ được sàng lọc tự động trong ít phút.</Text>}
            <div className={ROW_ACTIONS_CLASS_NAME}><Button variant="secondary" size="sm" isPending={isPending} isDisabled={isPending} onPress={() => run(() => rescreenAction(c.id), (o) => setMsg(o.status === "done" ? "Đã sàng lọc lại." : o.summary))}>Sàng lọc lại</Button></div>

            <Heading level={3}>CV</Heading>
            {detail?.cv ? (
              <>
                <div className={ROW_ACTIONS_CLASS_NAME}>
                  {detail.cv.mime === "application/pdf" || detail.cv.mime.startsWith("image/") ? <Button variant="secondary" size="sm" onPress={() => setShowCv((v) => !v)}>{showCv ? "Ẩn xem trước" : "Xem trước"}</Button> : null}
                  <Button variant="tertiary" size="sm" href={detail.cv.url} target="_blank" rel="noreferrer">{`Mở ${detail.cv.name}`}</Button>
                </div>
                {showCv ? (
                  <MediaFrame aspect="portrait" fit="contain">
                    {detail.cv.mime === "application/pdf" ? <iframe title="CV" src={detail.cv.url} className={CV_FRAME_CLASS_NAME} /> : <Image src={detail.cv.url} alt="CV" fit="contain" />}
                  </MediaFrame>
                ) : null}
                <Text size="xs" tone="muted">Liên kết xem CV chỉ có hiệu lực vài phút.</Text>
              </>
            ) : <Text tone="muted">{c.cv_path ? "Đang tải CV..." : "Ứng viên không gửi CV."}</Text>}

            <Heading level={3}>Câu trả lời</Heading>
            {c.answers.length ? c.answers.map((a) => (<div key={a.question_id} className={PAIR_CLASS_NAME}><Text size="sm" weight="medium">{a.question}</Text><Text size="sm">{a.answer}</Text></div>)) : <Text tone="muted">Chưa có câu trả lời.</Text>}
            {c.availability ? <div className={PAIR_CLASS_NAME}><Text size="sm" weight="medium">Lịch có thể làm</Text><Text size="sm">{c.availability}</Text></div> : null}

            {interviews.length ? (
              <>
                <Heading level={3}>Phỏng vấn</Heading>
                {interviews.map((i) => (<Text key={i.id} size="sm">{`${INTERVIEW_STATUS_LABEL[i.status]}${i.slot_start ? `: ${fmtVnDateTime(i.slot_start)}` : ""}${i.interviewer_name ? ` · ${i.interviewer_name}` : ""}`}</Text>))}
              </>
            ) : null}
            {offers.length ? (
              <>
                <Heading level={3}>Thư mời</Heading>
                {offers.map((o) => (
                  <div key={o.id} className={ROW_ACTIONS_CLASS_NAME}>
                    <Text size="sm">{`${OFFER_STATUS_LABEL[o.status]} · ${o.terms.pay}`}</Text>
                    {["draft", "waiting", "sent"].includes(o.status) ? <Button variant="ghost" size="sm" isDisabled={isPending} onPress={() => run(() => cancelOfferAction(o.id))}>Hủy thư</Button> : null}
                  </div>
                ))}
              </>
            ) : null}

            <Heading level={3}>Ghi chú</Heading>
            <Textarea label="Ghi chú nội bộ" isLabelHidden variant="secondary" rows={3} value={notes} onValueChange={setNotes} description="Chỉ ghi về kỹ năng, kinh nghiệm, lịch làm việc." />
            <div className={ROW_ACTIONS_CLASS_NAME}><Button variant="secondary" size="sm" isPending={isPending} isDisabled={isPending || notes === c.notes} onPress={() => run(() => saveNotesAction(c.id, notes), () => setMsg("Đã lưu ghi chú."))}>Lưu ghi chú</Button></div>

            <Heading level={3}>Lịch sử</Heading>
            {detail ? (
              detail.events.length ? (
                <List className={REASONS_CLASS_NAME}>
                  {detail.events.map((e) => (<ListItem key={e.id} className={PAIR_CLASS_NAME}><Text size="sm">{e.summary}</Text><Text size="xs" tone="muted">{`${e.actor} · ${fmtVnDateTime(e.created_at)}`}</Text></ListItem>))}
                </List>
              ) : <Text tone="muted">Chưa có.</Text>
            ) : <Text tone="muted">Đang tải...</Text>}

            <Heading level={3}>Dữ liệu của ứng viên</Heading>
            <Text size="sm" tone="muted">{`Hồ sơ được lưu riêng trong kho của doanh nghiệp, tự xóa sau ${data.settings?.retention_days ?? 90} ngày khi bị loại hoặc rút. Ứng viên yêu cầu xóa thì xóa ngay.`}</Text>
            <div className={ROW_ACTIONS_CLASS_NAME}><Button variant="danger-soft" size="sm" onPress={() => setDialog("delete")}>Xóa hồ sơ ngay</Button></div>
          </div>
        ) : null}
      </Drawer>
      {c && dialog === "interview" ? <InterviewDialog key={`iv-${c.id}`} c={c} data={data} onClose={() => setDialog(null)} /> : null}
      {c && dialog === "offer" ? <OfferDialog key={`of-${c.id}`} c={c} data={data} onClose={() => setDialog(null)} /> : null}
      {c && dialog === "reject" ? (
        <Dialog
          isOpen onOpenChange={(o) => { if (!o) setDialog(null); }} size="md" title={`Loại ${c.name}`} closeLabel="Đóng"
          description="Loại là quyết định của bạn. Ghi lý do theo yêu cầu công việc."
          footer={(close) => (<><Button variant="tertiary" onPress={close}>Hủy</Button><Button variant="danger" isPending={isPending} isDisabled={isPending || reason.trim().length < 3} onPress={() => run(() => moveCandidateAction(c.id, "rejected", reason.trim()), () => setDialog(null))}>Loại ứng viên</Button></>)}
        >
          <div className={FORM_CLASS_NAME}>{error ? <Alert tone="negative" title="Chưa loại được" description={error} urgency="assertive" /> : null}<Textarea label="Lý do" variant="secondary" rows={3} value={reason} onValueChange={setReason} /></div>
        </Dialog>
      ) : null}
      {c && dialog === "delete" ? (
        <AlertDialog
          isOpen onOpenChange={(o) => { if (!o) setDialog(null); }} tone="negative" title={`Xóa hồ sơ ${c.name}?`}
          description="Xóa vĩnh viễn thông tin, câu trả lời, file CV, lịch phỏng vấn và thư mời của ứng viên này. Không khôi phục được."
          confirmLabel="Xóa vĩnh viễn" cancelLabel="Hủy" isConfirmPending={isPending}
          onConfirm={() => run(() => deleteCandidateAction(c.id), () => { setDialog(null); onClose(); })}
        >
          <Text>Dùng khi ứng viên yêu cầu xóa dữ liệu của họ.</Text>
        </AlertDialog>
      ) : null}
    </>
  );
};
