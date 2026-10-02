"use client";

import { useMemo, useState } from "react";
import { Alert, Badge, Button, EmptyNotice, Heading, SurfaceListCard, Text } from "@starci/grammar/common";
import type { HiringWorkbenchData } from "@/lib/module-hiring-queries";
import { INTERVIEW_STATUS_LABEL, fmtVnDateTime, vnInstant, vnParts, type InterviewRow } from "@/lib/module-hiring-shared";
import { setInterviewStatusAction } from "./actions";
import { CHIPS_CLASS_NAME, DAY_CLASS_NAME, ROW_ACTIONS_CLASS_NAME, ROW_CLASS_NAME, ROW_MAIN_CLASS_NAME, SECTION_HEAD_CLASS_NAME, SLOT_CLASS_NAME, WEEK_CLASS_NAME } from "./classNames";
import { copyText, useRunner } from "./parts";

const DAY_NAMES = ["Chủ nhật", "Thứ hai", "Thứ ba", "Thứ tư", "Thứ năm", "Thứ sáu", "Thứ bảy"];
const hhmm = (iso: string): string => {
  const p = vnParts(new Date(iso));
  return `${String(Math.floor(p.minute / 60)).padStart(2, "0")}:${String(p.minute % 60).padStart(2, "0")}`;
};

/** Props for {@link InterviewsPanel}. */
export type InterviewsPanelProps = { readonly data: HiringWorkbenchData; readonly onOpen: (candidateId: string) => void };

/** Tab "Lịch phỏng vấn": a week calendar of confirmed interviews (an agenda on phones), and the invitations still waiting for the candidate to pick a time. */
export const InterviewsPanel = ({ data, onOpen }: InterviewsPanelProps) => {
  const [week, setWeek] = useState(0);
  const [copied, setCopied] = useState<string | null>(null);
  const { run, isPending, error, setError } = useRunner();
  const names = useMemo(() => new Map(data.candidates.map((c) => [c.id, c.name])), [data.candidates]);
  const titles = useMemo(() => new Map(data.jobs.map((j) => [j.id, j.title])), [data.jobs]);

  const now = new Date(data.nowIso);
  const today = vnParts(now);
  const mondayOffset = (today.weekday + 6) % 7;
  const days = Array.from({ length: 7 }, (_, i) => {
    const start = vnInstant(today.y, today.m, today.day - mondayOffset + week * 7 + i, 0);
    const p = vnParts(start);
    return { start, end: new Date(start.getTime() + 86_400_000), p };
  });
  const confirmed = data.interviews.filter((i) => i.status === "confirmed" && i.slot_start);
  const proposed = data.interviews.filter((i) => i.status === "proposed");
  const range = `${String(days[0].p.day).padStart(2, "0")}/${String(days[0].p.m + 1).padStart(2, "0")} - ${String(days[6].p.day).padStart(2, "0")}/${String(days[6].p.m + 1).padStart(2, "0")}/${days[6].p.y}`;

  const actions = (i: InterviewRow) => (
    <div className={ROW_ACTIONS_CLASS_NAME}>
      <Button variant="tertiary" size="sm" onPress={() => onOpen(i.candidate_id)}>Mở hồ sơ</Button>
      {i.status === "confirmed" ? <Button variant="secondary" size="sm" isDisabled={isPending} onPress={() => run(() => setInterviewStatusAction(i.id, "done"))}>Đã phỏng vấn</Button> : null}
      {i.status === "confirmed" ? <Button variant="ghost" size="sm" isDisabled={isPending} onPress={() => run(() => setInterviewStatusAction(i.id, "no_show"))}>Không đến</Button> : null}
      <Button variant="ghost" size="sm" isDisabled={isPending} onPress={() => run(() => setInterviewStatusAction(i.id, "cancelled"))}>Hủy lịch</Button>
    </div>
  );

  return (
    <>
      <div className={SECTION_HEAD_CLASS_NAME}>
        <Heading level={2}>Lịch phỏng vấn</Heading>
        <div className={ROW_ACTIONS_CLASS_NAME}>
          <Button variant="tertiary" size="sm" onPress={() => setWeek((w) => w - 1)}>Tuần trước</Button>
          <Text as="span" size="sm" weight="medium">{week === 0 ? `Tuần này (${range})` : range}</Text>
          <Button variant="tertiary" size="sm" onPress={() => setWeek((w) => w + 1)}>Tuần sau</Button>
          {week !== 0 ? <Button variant="ghost" size="sm" onPress={() => setWeek(0)}>Về tuần này</Button> : null}
        </div>
      </div>
      {error ? <Alert tone="negative" title="Chưa làm được" description={error} dismissLabel="Ẩn" onDismiss={() => setError(null)} urgency="assertive" /> : null}
      <div className={WEEK_CLASS_NAME}>
        {days.map((d) => {
          const items = confirmed.filter((i) => Date.parse(i.slot_start!) >= d.start.getTime() && Date.parse(i.slot_start!) < d.end.getTime()).sort((a, b) => a.slot_start!.localeCompare(b.slot_start!));
          const isToday = week === 0 && d.p.day === today.day && d.p.m === today.m;
          return (
            <section key={d.start.toISOString()} className={DAY_CLASS_NAME} aria-label={`${DAY_NAMES[d.p.weekday]} ${d.p.day}/${d.p.m + 1}`}>
              <div className={CHIPS_CLASS_NAME}>
                <Text as="span" size="sm" weight="semibold">{DAY_NAMES[d.p.weekday]}</Text>
                <Text as="span" size="xs" tone="muted">{`${String(d.p.day).padStart(2, "0")}/${String(d.p.m + 1).padStart(2, "0")}`}</Text>
                {isToday ? <Badge tone="accent">Hôm nay</Badge> : null}
              </div>
              {items.length === 0 ? <Text size="xs" tone="muted">Trống</Text> : items.map((i) => (
                <div key={i.id} className={SLOT_CLASS_NAME}>
                  <Text size="sm" weight="semibold">{`${hhmm(i.slot_start!)} · ${names.get(i.candidate_id) ?? "Ứng viên"}`}</Text>
                  <Text size="xs" tone="muted">{[titles.get(i.job_id), i.interviewer_name, i.mode === "online" ? "Online" : i.location].filter(Boolean).join(" · ")}</Text>
                  {actions(i)}
                </div>
              ))}
            </section>
          );
        })}
      </div>
      <SurfaceListCard
        label="Chờ ứng viên chọn giờ" fact={`${proposed.length} lời mời`}
        empty={<EmptyNotice message="Không có lời mời nào đang chờ" description="Mở hồ sơ ứng viên và bấm Xếp lịch phỏng vấn. NIVO gửi 3 giờ để ứng viên chọn." />}
      >
        {proposed.map((i) => (
          <li key={i.id} className={ROW_CLASS_NAME}>
            <div className={ROW_MAIN_CLASS_NAME}>
              <div className={CHIPS_CLASS_NAME}>
                <Text as="span" weight="semibold">{names.get(i.candidate_id) ?? "Ứng viên"}</Text>
                <Badge tone="warning">{i.note ? "Báo không có giờ hợp" : INTERVIEW_STATUS_LABEL[i.status]}</Badge>
              </div>
              <Text size="sm" tone="muted">{`${titles.get(i.job_id) ?? ""}${i.interviewer_name ? ` · ${i.interviewer_name}` : ""}`}</Text>
              <Text size="xs" tone="muted">{`Đề xuất: ${i.proposed_slots.map((s) => fmtVnDateTime(s.start)).join("; ")}`}</Text>
              {i.note ? <Text size="sm">{i.note}. Hủy lịch này rồi xếp lại ở hồ sơ ứng viên.</Text> : null}
            </div>
            <div className={ROW_ACTIONS_CLASS_NAME}>
              <Button variant="tertiary" size="sm" onPress={() => void copyText(`${data.origin}/j/lich/${i.token}`).then((ok) => setCopied(ok ? i.id : null))}>{copied === i.id ? "Đã chép link" : "Chép link chọn giờ"}</Button>
              {actions(i)}
            </div>
          </li>
        ))}
      </SurfaceListCard>
    </>
  );
};
