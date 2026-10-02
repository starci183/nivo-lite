"use client";

import { Alert, Badge, Button, Checkbox, EmptyNotice, Heading, Meter, Text } from "@starci/grammar/common";
import type { HiringWorkbenchData } from "@/lib/module-hiring-queries";
import { linkStaffAction, toggleOnboardingAction } from "./actions";
import { CARD_CLASS_NAME, CHIPS_CLASS_NAME, FORM_CLASS_NAME, SECTION_HEAD_CLASS_NAME } from "./classNames";
import { useRunner } from "./parts";

/** Props for {@link OnboardingPanel}. */
export type OnboardingPanelProps = { readonly data: HiringWorkbenchData };

/** Tab "Nhận việc": people who said yes, each with the checklist of what to do before the first day. */
export const OnboardingPanel = ({ data }: OnboardingPanelProps) => {
  const { run, isPending, error, setError } = useRunner();
  const hired = data.candidates.filter((c) => c.stage === "hired");
  const jobTitle = new Map(data.jobs.map((j) => [j.id, j.title]));
  return (
    <>
      <div className={SECTION_HEAD_CLASS_NAME}><Heading level={2}>Nhận việc</Heading></div>
      {error ? <Alert tone="negative" title="Chưa lưu được" description={error} dismissLabel="Ẩn" onDismiss={() => setError(null)} urgency="assertive" /> : null}
      {hired.length === 0 ? (
        <EmptyNotice message="Chưa có ai nhận việc" description="Khi ứng viên đồng ý thư mời, họ xuất hiện ở đây cùng danh sách việc cần làm trước ngày đầu." />
      ) : hired.map((c) => {
        const items = data.onboarding.filter((o) => o.candidate_id === c.id);
        const done = items.filter((i) => i.done).length;
        return (
          <section key={c.id} className={CARD_CLASS_NAME} aria-label={c.name}>
            <div className={CHIPS_CLASS_NAME}>
              <Text as="span" weight="semibold">{c.name}</Text>
              <Badge tone="success">{jobTitle.get(c.job_id) ?? ""}</Badge>
              <Text as="span" size="sm" tone="muted">{[c.phone, c.email].filter(Boolean).join(" · ")}</Text>
              {c.staff_id ? <Badge tone="accent">Đã có hồ sơ nhân viên</Badge> : <Button variant="secondary" size="sm" isDisabled={isPending} onPress={() => run(() => linkStaffAction(c.id))}>Tạo hồ sơ nhân viên</Button>}
            </div>
            {items.length ? <Meter label="Tiến độ nhận việc" value={done} minValue={0} maxValue={items.length} valueLabel={`${done}/${items.length}`} /> : null}
            <div className={FORM_CLASS_NAME}>
              {items.map((i) => <Checkbox key={i.id} label={i.title} isSelected={i.done} isDisabled={isPending} onSelectedChange={(v) => run(() => toggleOnboardingAction(i.id, v))} />)}
            </div>
          </section>
        );
      })}
    </>
  );
};
