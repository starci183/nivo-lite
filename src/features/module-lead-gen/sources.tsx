"use client";

import { EmptyNotice, ListRow, SurfaceListCard } from "@starci/grammar/common";
import { useT } from "@/i18n/client";
import { workbenchLeadGen } from "@/i18n/dict/workbenchLeadGen";
import type { LeadGenSource } from "@/lib/workbench-lead-gen";
import { SourceBadge } from "./parts";

/** Props for {@link SourcesPanel}. */
export type SourcesPanelProps = { readonly rows: ReadonlyArray<LeadGenSource> };

/** "Nguồn": per post / ad / form, how many leads it brought, how many are hot and how many were won. */
export const SourcesPanel = ({ rows }: SourcesPanelProps) => {
  const t = useT(workbenchLeadGen);
  const nameOf = (s: LeadGenSource): string => {
    const { refKind, refId, refLabel } = s.origin;
    if (refLabel) return refLabel;
    if (!refKind || !refId) return t("sourceNoRef");
    return t(refKind === "ad" ? "refAd" : refKind === "form" ? "refForm" : "refPost", { id: refId });
  };
  return (
    <SurfaceListCard ariaLabel={t("sourcesLabel")} empty={<EmptyNotice message={t("sourcesEmptyTitle")} description={t("sourcesEmptyBody")} />}>
      {rows.map((row) => (
        <ListRow
          key={row.key}
          title={nameOf(row)}
          description={t("sourceCounts", { leads: row.leads, hot: row.hot, won: row.won })}
          badges={<SourceBadge origin={row.origin} />}
        />
      ))}
    </SurfaceListCard>
  );
};
