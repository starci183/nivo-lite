"use client";

import { EmptyNotice, SectionHeader, Text } from "@starci/grammar/common";
import { ExceptionCard } from "@/features/office/exceptions";
import { useT } from "@/i18n/client";
import { workbenchAccounting } from "@/i18n/dict/workbenchAccounting";
import type { AccountingWorkbench, QuestionGroup } from "@/lib/workbench-accounting";
import { BLOCK_CLASS_NAME, PANEL_CLASS_NAME, QUESTIONS_CLASS_NAME } from "./classNames";

const GROUPS: ReadonlyArray<QuestionGroup> = ["unclear_payment", "over_limit", "missing_data", "other"];

/**
 * "Câu hỏi cần trả lời": the accounting work NIVO stopped on, grouped by what it is about. Each card is the existing decide
 * card (same permissions; a reconciliation still needs a written basis before a payment is confirmed).
 */
export const QuestionsPanel = ({ data }: { readonly data: AccountingWorkbench }) => {
  const t = useT(workbenchAccounting);
  if (data.questions.length === 0) {
    return (
      <div className={PANEL_CLASS_NAME}>
        <EmptyNotice message={t("questionsEmpty")} description={t("questionsEmptyBody")} />
      </div>
    );
  }
  return (
    <div className={PANEL_CLASS_NAME}>
      <Text size="sm" tone="muted">{t("questionsIntro")}</Text>
      {GROUPS.map((group) => {
        const rows = data.questions.filter((q) => q.group === group);
        if (rows.length === 0) return null;
        return (
          <section key={group} className={BLOCK_CLASS_NAME} aria-label={t(`group_${group}`)}>
            <SectionHeader level={2} title={`${t(`group_${group}`)} (${rows.length})`} description={t(`groupHint_${group}`)} />
            <div className={QUESTIONS_CLASS_NAME}>
              {rows.map((q) => <ExceptionCard key={q.item.id} item={q.item} staff={data.staff} ownerName={data.ownerName} isFocused={false} />)}
            </div>
          </section>
        );
      })}
    </div>
  );
};
