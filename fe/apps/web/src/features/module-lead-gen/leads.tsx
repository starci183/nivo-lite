"use client";

import { EmptyNotice, ListRow, SurfaceListCard, Text, TextAction } from "@starci/grammar/common";
import { formatWhen } from "@/features/agent-dashboard";
import { useLocale, useT } from "@/i18n/client";
import { workbenchLeadGen } from "@/i18n/dict/workbenchLeadGen";
import type { LeadGenLead } from "@/lib/workbench-lead-gen";
import { ScoreBadge, SourceBadge } from "./parts";

/** Props for {@link LeadsPanel}. */
export type LeadsPanelProps = { readonly rows: ReadonlyArray<LeadGenLead>; readonly hidden: number };

/** "Lead mới": newest activity first; the name opens the lead and its conversation. */
export const LeadsPanel = ({ rows, hidden }: LeadsPanelProps) => {
  const t = useT(workbenchLeadGen);
  const locale = useLocale();
  return (
    <>
      <SurfaceListCard ariaLabel={t("leadsLabel")} empty={<EmptyNotice message={t("leadsEmptyTitle")} description={t("leadsEmptyBody")} />}>
        {rows.map((row) => (
          <ListRow
            key={row.id}
            title={<TextAction href={row.href}>{row.name}</TextAction>}
            description={t("lastLine", { text: row.lastText || "—", when: formatWhen(row.lastAt, locale) })}
            badges={<><SourceBadge origin={row.origin} /><ScoreBadge score={row.score} /></>}
          />
        ))}
      </SurfaceListCard>
      {hidden > 0 ? <Text size="sm" tone="muted">{t("leadsHidden", { n: hidden })}</Text> : null}
    </>
  );
};
