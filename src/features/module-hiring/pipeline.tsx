"use client";

import { useMemo, useState } from "react";
import { Alert, Badge, Button, Dialog, EmptyNotice, Heading, Select, Text, Textarea } from "@starci/grammar/common";
import type { HiringWorkbenchData } from "@/lib/module-hiring-queries";
import { BOARD_STAGES, SCORE_LABEL, STAGE_LABEL, type CandidateRow, type Stage } from "@/lib/module-hiring-shared";
import { moveCandidateAction } from "./actions";
import {
  BOARD_CLASS_NAME, CARD_CLASS_NAME, CARD_DRAG_CLASS_NAME, CHIPS_CLASS_NAME, FORM_CLASS_NAME, LANE_BODY_CLASS_NAME, LANE_CLASS_NAME, LANE_HEAD_CLASS_NAME, LANE_OVER_CLASS_NAME,
  PIPELINE_LIST_CLASS_NAME, SECTION_HEAD_CLASS_NAME,
} from "./classNames";
import { SOURCE_LABEL, ago, scoreTone, stageTone, useRunner } from "./parts";

const ALL_JOBS = "all";

/** Props for {@link PipelinePanel}. */
export type PipelinePanelProps = {
  readonly data: HiringWorkbenchData;
  readonly jobId: string;
  readonly onJob: (id: string) => void;
  readonly onOpen: (candidateId: string) => void;
};

const MoveSelect = ({ c, onMove, disabled }: { readonly c: CandidateRow; readonly onMove: (c: CandidateRow, to: Stage) => void; readonly disabled: boolean }) => (
  <Select
    label="Chuyển sang" isLabelHidden isDisabled={disabled} placeholder="Chuyển sang..." value={null}
    options={BOARD_STAGES.filter((s) => s !== c.stage && s !== "hired" && s !== "offer").map((s) => ({ id: s, label: STAGE_LABEL[s] }))}
    onValueChange={(v) => { if (v) onMove(c, v as Stage); }}
  />
);

/** Tab "Ứng viên": the pipeline of one job (or all), a lane per stage. Drag a card, or use "Chuyển sang"; "Loại" asks for a reason and is always a person's decision. */
export const PipelinePanel = ({ data, jobId, onJob, onOpen }: PipelinePanelProps) => {
  const [dragId, setDragId] = useState<string | null>(null);
  const [over, setOver] = useState<Stage | null>(null);
  const [rejecting, setRejecting] = useState<CandidateRow | null>(null);
  const [reason, setReason] = useState("");
  const { run, isPending, error, setError } = useRunner();
  const jobTitle = useMemo(() => new Map(data.jobs.map((j) => [j.id, j.title])), [data.jobs]);
  const shown = useMemo(() => data.candidates.filter((c) => (jobId === ALL_JOBS || c.job_id === jobId) && c.stage !== "withdrawn"), [data.candidates, jobId]);
  const withdrawn = data.candidates.filter((c) => (jobId === ALL_JOBS || c.job_id === jobId) && c.stage === "withdrawn").length;
  const by = (s: Stage) => shown.filter((c) => c.stage === s).sort((a, b) => (b.score ?? -1) - (a.score ?? -1) || b.created_at.localeCompare(a.created_at));

  const move = (c: CandidateRow, to: Stage) => {
    if (to === c.stage) return;
    if (to === "rejected") {
      setRejecting(c);
      setReason("");
      return;
    }
    run(() => moveCandidateAction(c.id, to));
  };
  const confirmReject = () => {
    if (!rejecting) return;
    run(() => moveCandidateAction(rejecting.id, "rejected", reason.trim()), () => setRejecting(null));
  };

  const Card = ({ c, draggable }: { readonly c: CandidateRow; readonly draggable: boolean }) => (
    <li
      className={`${CARD_CLASS_NAME} ${draggable ? CARD_DRAG_CLASS_NAME : ""}`}
      draggable={draggable}
      onDragStart={draggable ? (e) => { e.dataTransfer.setData("text/plain", c.id); e.dataTransfer.effectAllowed = "move"; setDragId(c.id); } : undefined}
      onDragEnd={draggable ? () => { setDragId(null); setOver(null); } : undefined}
    >
      <div className={CHIPS_CLASS_NAME}>
        <Text as="span" weight="semibold">{c.name}</Text>
        {c.score !== null ? <Badge tone={scoreTone(c.score_label)}>{`${c.score}/100`}</Badge> : <Badge tone="neutral">Chưa chấm</Badge>}
      </div>
      <Text size="xs" tone="muted">{[jobId === ALL_JOBS ? jobTitle.get(c.job_id) : null, SOURCE_LABEL[c.source] ?? c.source, ago(c.created_at, data.nowIso)].filter(Boolean).join(" · ")}</Text>
      {c.score_label ? <Text size="xs">{`Gợi ý: ${SCORE_LABEL[c.score_label]}`}</Text> : null}
      <div className={CHIPS_CLASS_NAME}>
        <Button variant="tertiary" size="sm" onPress={() => onOpen(c.id)}>Mở hồ sơ</Button>
      </div>
      <MoveSelect c={c} onMove={move} disabled={isPending} />
    </li>
  );

  const lane = (s: Stage) => {
    const list = by(s);
    return (
      <section
        key={s} className={`${LANE_CLASS_NAME} ${over === s ? LANE_OVER_CLASS_NAME : ""}`} aria-label={STAGE_LABEL[s]}
        onDragOver={(e) => { if (dragId) { e.preventDefault(); setOver(s); } }}
        onDragLeave={() => setOver((o) => (o === s ? null : o))}
        onDrop={(e) => {
          e.preventDefault();
          const id = e.dataTransfer.getData("text/plain") || dragId;
          setOver(null);
          setDragId(null);
          const c = data.candidates.find((x) => x.id === id);
          if (c) move(c, s);
        }}
      >
        <div className={LANE_HEAD_CLASS_NAME}>
          <Badge tone={stageTone(s)} isDot>{STAGE_LABEL[s]}</Badge>
          <Text as="span" size="xs" tone="muted">{list.length}</Text>
        </div>
        {list.length === 0 ? <Text size="sm" tone="muted">Chưa có ai</Text> : <ul className={LANE_BODY_CLASS_NAME}>{list.map((c) => <Card key={c.id} c={c} draggable />)}</ul>}
      </section>
    );
  };

  return (
    <>
      <div className={SECTION_HEAD_CLASS_NAME}>
        <Heading level={2}>Ứng viên</Heading>
        <Select
          label="Tin tuyển dụng" isLabelHidden value={jobId}
          options={[{ id: ALL_JOBS, label: "Tất cả tin" }, ...data.jobs.map((j) => ({ id: j.id, label: j.title }))]} onValueChange={(v) => onJob(v ?? ALL_JOBS)}
        />
      </div>
      {error ? <Alert tone="negative" title="Chưa chuyển được" description={error} dismissLabel="Ẩn" onDismiss={() => setError(null)} urgency="assertive" /> : null}
      {shown.length === 0 && data.candidates.length === 0 ? (
        <EmptyNotice message="Chưa có ứng viên" description="Mở một tin tuyển dụng, chép link ứng tuyển và đăng lên nhóm Facebook hoặc Zalo. Hồ sơ nộp qua link hoặc chat sẽ hiện ở đây." />
      ) : (
        <>
          <div className={BOARD_CLASS_NAME}>{BOARD_STAGES.map(lane)}</div>
          <div className={PIPELINE_LIST_CLASS_NAME}>
            {BOARD_STAGES.map((s) => {
              const list = by(s);
              return list.length === 0 ? null : (
                <section key={s} aria-label={STAGE_LABEL[s]} className={FORM_CLASS_NAME}>
                  <div className={LANE_HEAD_CLASS_NAME}><Badge tone={stageTone(s)} isDot>{STAGE_LABEL[s]}</Badge><Text as="span" size="xs" tone="muted">{list.length}</Text></div>
                  <ul className={LANE_BODY_CLASS_NAME}>{list.map((c) => <Card key={c.id} c={c} draggable={false} />)}</ul>
                </section>
              );
            })}
          </div>
          {withdrawn > 0 ? <Text size="sm" tone="muted">{`${withdrawn} ứng viên đã rút hồ sơ (ẩn khỏi bảng, tự xóa theo thời hạn lưu).`}</Text> : null}
        </>
      )}
      {rejecting ? (
        <Dialog
          isOpen onOpenChange={(o) => { if (!o) setRejecting(null); }} size="md" title={`Loại ${rejecting.name}`} closeLabel="Đóng"
          description="Loại là quyết định của bạn, không phải của NIVO. Ghi lý do theo yêu cầu công việc (kỹ năng, kinh nghiệm, lịch làm) để lưu hồ sơ."
          footer={(close) => (<><Button variant="tertiary" onPress={close}>Hủy</Button><Button variant="danger" isPending={isPending} isDisabled={isPending || reason.trim().length < 3} onPress={confirmReject}>Loại ứng viên</Button></>)}
        >
          <div className={FORM_CLASS_NAME}>
            {error ? <Alert tone="negative" title="Chưa loại được" description={error} urgency="assertive" /> : null}
            <Textarea label="Lý do" rows={3} value={reason} onValueChange={setReason} />
            <Text size="sm" tone="muted">Ứng viên đã loại được giữ theo thời hạn lưu hồ sơ rồi tự xóa.</Text>
          </div>
        </Dialog>
      ) : null}
    </>
  );
};
