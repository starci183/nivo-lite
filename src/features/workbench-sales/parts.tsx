"use client";

import { Badge, Text, type BadgeTone } from "@starci/grammar/common";
import { useT } from "@/i18n/client";
import { governance } from "@/i18n/dict/governance";
import { workbenchSales } from "@/i18n/dict/workbenchSales";
import type { LeadStage } from "@/lib/types";
import { ageParts, isStale } from "./format";

/** Badge tone per stage. */
export const stageTone = (stage: LeadStage): BadgeTone => {
  if (stage === "won") return "success";
  if (stage === "lost") return "danger";
  if (stage === "proposal") return "accent";
  return "neutral";
};

/** The stage of a customer as a badge. */
export const StageBadge = ({ stage }: { readonly stage: LeadStage | null }) => {
  const t = useT(workbenchSales);
  if (!stage) return null;
  return <Badge tone={stageTone(stage)}>{t(`stage_${stage}`)}</Badge>;
};

/** "3 giờ" style age, red once it is a day or more. */
export const AgeText = ({ since, nowIso, prefix }: { readonly since: string; readonly nowIso: string; readonly prefix?: string }) => {
  const t = useT(workbenchSales);
  const a = ageParts(since, nowIso);
  const text = a.unit === "now" ? t("ageNow") : t(`age_${a.unit}`, { n: a.n });
  return <Text as="span" size="xs" tone="muted" weight={isStale(since, nowIso) ? "semibold" : "normal"}>{prefix ? `${prefix} ${text}` : text}</Text>;
};

const KNOWN_FIELDS = ["contact_name", "need", "contact", "customer", "items", "amount_vnd"] as const;

/** Label of a data field NIVO can ask for; an unknown field shows its own name. */
export const useFieldLabel = (): ((name: string) => string) => {
  const g = useT(governance);
  return (name) => ((KNOWN_FIELDS as ReadonlyArray<string>).includes(name) ? g(`field_${name as (typeof KNOWN_FIELDS)[number]}`) : name);
};
