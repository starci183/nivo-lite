"use client";

import { Badge, type BadgeTone } from "@starci/grammar/common";
import { useT } from "@/i18n/client";
import { workbenchLeadGen } from "@/i18n/dict/workbenchLeadGen";
import type { LeadOrigin, LeadScore } from "@/lib/workbench-lead-gen";

const SCORE_TONE: Record<LeadScore, BadgeTone> = { hot: "danger", warm: "warning", cold: "neutral" };

/** "Facebook · lead ad": where a lead came from. */
export const SourceBadge = ({ origin }: { readonly origin: Pick<LeadOrigin, "platform" | "kind"> }) => {
  const t = useT(workbenchLeadGen);
  return <Badge tone="neutral">{t("sourceBadge", { platform: t(`platform_${origin.platform}`), kind: t(`kind_${origin.kind}`) })}</Badge>;
};

/** hot / warm / cold, or "not scored". */
export const ScoreBadge = ({ score }: { readonly score: LeadScore | null }) => {
  const t = useT(workbenchLeadGen);
  return score ? <Badge tone={SCORE_TONE[score]} isDot>{t(`score_${score}`)}</Badge> : <Badge tone="neutral">{t("score_none")}</Badge>;
};
