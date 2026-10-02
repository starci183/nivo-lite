"use client";

import { useState } from "react";
import { Alert, Badge, Button, EmptyNotice, Heading, SurfaceListCard, Text } from "@starci/grammar/common";
import type { HiringWorkbenchData } from "@/lib/module-hiring-queries";
import { OFFER_STATUS_LABEL, fmtVnDate, type OfferStatus } from "@/lib/module-hiring-shared";
import { cancelOfferAction } from "./actions";
import { CHIPS_CLASS_NAME, ROW_ACTIONS_CLASS_NAME, ROW_CLASS_NAME, ROW_MAIN_CLASS_NAME, SECTION_HEAD_CLASS_NAME } from "./classNames";
import { copyText, useRunner } from "./parts";

const tone = (s: OfferStatus) => (s === "accepted" ? "success" : s === "declined" || s === "expired" || s === "cancelled" ? "danger" : s === "waiting" ? "warning" : "accent") as "success" | "danger" | "warning" | "accent";

/** Props for {@link OffersPanel}. */
export type OffersPanelProps = { readonly data: HiringWorkbenchData; readonly onOpen: (candidateId: string) => void };

/** Tab "Thư mời": every offer with where it stands. A letter waiting for you is approved in Quyết định; sending always needs that approval. */
export const OffersPanel = ({ data, onOpen }: OffersPanelProps) => {
  const [copied, setCopied] = useState<string | null>(null);
  const { run, isPending, error, setError } = useRunner();
  const names = new Map(data.candidates.map((c) => [c.id, c.name]));
  const titles = new Map(data.jobs.map((j) => [j.id, j.title]));
  return (
    <>
      <div className={SECTION_HEAD_CLASS_NAME}>
        <Heading level={2}>Thư mời nhận việc</Heading>
        {data.waitingApprovals > 0 ? <Button variant="primary" href="/decisions">{`Duyệt ${data.waitingApprovals} việc đang chờ`}</Button> : null}
      </div>
      {error ? <Alert tone="negative" title="Chưa làm được" description={error} dismissLabel="Ẩn" onDismiss={() => setError(null)} urgency="assertive" /> : null}
      <SurfaceListCard
        label="Danh sách thư mời" fact={`${data.offers.length} thư`}
        empty={<EmptyNotice message="Chưa có thư mời" description="Mở hồ sơ một ứng viên đã phỏng vấn và bấm Soạn thư mời. OpenClaw soạn, bạn duyệt rồi mới gửi." />}
      >
        {data.offers.map((o) => (
          <li key={o.id} className={ROW_CLASS_NAME}>
            <div className={ROW_MAIN_CLASS_NAME}>
              <div className={CHIPS_CLASS_NAME}>
                <Text as="span" weight="semibold">{names.get(o.candidate_id) ?? "Ứng viên"}</Text>
                <Badge tone={tone(o.status)} isDot>{OFFER_STATUS_LABEL[o.status]}</Badge>
              </div>
              <Text size="sm" tone="muted">{[titles.get(o.job_id), o.terms.pay, o.terms.start_date ? `bắt đầu ${o.terms.start_date}` : ""].filter(Boolean).join(" · ")}</Text>
              {o.sent_at ? <Text size="xs" tone="muted">{`Gửi ${fmtVnDate(o.sent_at)} qua ${o.sent_via === "chat" ? "chat" : o.sent_via === "email" ? "email" : "(chưa gửi tự động, bạn gửi link cho ứng viên)"}${o.expires_at ? ` · hạn ${fmtVnDate(o.expires_at)}` : ""}`}</Text> : null}
            </div>
            <div className={ROW_ACTIONS_CLASS_NAME}>
              <Button variant="tertiary" size="sm" onPress={() => onOpen(o.candidate_id)}>Mở hồ sơ</Button>
              {o.status === "waiting" ? <Button variant="primary" size="sm" href="/decisions">Duyệt trong Quyết định</Button> : null}
              {o.status === "sent" ? <Button variant="secondary" size="sm" onPress={() => void copyText(`${data.origin}/j/thu/${o.token}`).then((ok) => setCopied(ok ? o.id : null))}>{copied === o.id ? "Đã chép link" : "Chép link thư"}</Button> : null}
              {["draft", "waiting", "sent"].includes(o.status) ? <Button variant="ghost" size="sm" isDisabled={isPending} onPress={() => run(() => cancelOfferAction(o.id))}>Hủy thư</Button> : null}
            </div>
          </li>
        ))}
      </SurfaceListCard>
    </>
  );
};
