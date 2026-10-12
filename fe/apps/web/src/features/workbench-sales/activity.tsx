"use client";

import { Badge, EmptyNotice, SurfaceCard, SurfaceListCard, Text, TextAction, type BadgeTone } from "@starci/grammar/common";
import { useLocale, useT } from "@/i18n/client";
import { governance } from "@/i18n/dict/governance";
import { workbenchSales } from "@/i18n/dict/workbenchSales";
import type { EvidenceState } from "@/lib/flow-types";
import type { AutoActivity } from "@/lib/workbench-sales";
import { CHIPS_CLASS_NAME, ROW_CLASS_NAME, ROW_MAIN_CLASS_NAME } from "./classNames";
import { formatDateTime } from "./format";

const EVIDENCE_TONE: Record<EvidenceState, BadgeTone> = { pending: "warning", captured: "neutral", reviewed: "accent", verified: "success", customer_confirmed: "success" };

/** Props for {@link ActivityPanel}. */
export type ActivityPanelProps = { readonly rows: ReadonlyArray<AutoActivity> };

/** Surface 5: routine work NIVO did by policy, inside the authority the owner gave, with its evidence. */
export const ActivityPanel = ({ rows }: ActivityPanelProps) => {
  const t = useT(workbenchSales);
  const g = useT(governance);
  const locale = useLocale();
  return (
    <>
      <Text size="sm" tone="muted">{t("activityIntro")}</Text>
      <SurfaceListCard ariaLabel={t("tab_activity")} empty={<EmptyNotice message={t("activityEmptyTitle")} description={t("activityEmptyBody")} />}>
        {rows.map((row) => (
          <li key={row.id} className={ROW_CLASS_NAME}>
            <div className={ROW_MAIN_CLASS_NAME}>
              <div className={CHIPS_CLASS_NAME}>
                <Text as="span" weight="semibold">{g(`action_${row.action}`)}</Text>
                <Badge tone={EVIDENCE_TONE[row.evidenceState]}>{t(`evidence_${row.evidenceState}`)}</Badge>
                <Text as="span" size="xs" tone="muted">{formatDateTime(row.at, locale)}</Text>
              </div>
              {row.customer ? <TextAction href={row.href} size="sm">{row.customer}</TextAction> : null}
              <Text size="sm">{row.summary}</Text>
              {row.evidence ? (
                <SurfaceCard depth="nested" ariaLabel={t("evidenceLabel")}>
                  <Text size="xs" tone="muted" weight="medium">{t("evidenceLabel")}</Text>
                  <Text as="p" size="sm" overflow="clamp-2">{row.evidence}</Text>
                </SurfaceCard>
              ) : null}
              <Text size="xs" tone="muted">{t("byPolicy")}</Text>
            </div>
          </li>
        ))}
      </SurfaceListCard>
    </>
  );
};
