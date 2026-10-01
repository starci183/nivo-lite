"use client";

import { Alert, Badge, Button, DescriptionList, EmptyNotice, Heading, Icon, SurfaceCard, Text } from "@starci/grammar/common";
import { nivoIconSource, type IconName } from "@/ui";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { useLocale, useT } from "@/i18n/client";
import { intlLocale, TIME_ZONE } from "@/i18n/core";
import { lead as leadDict } from "@/i18n/dict/lead";
import { refreshContext } from "@/lib/actions";
import type { LeadDetail } from "@/lib/types";
import { AiChip } from "@/features/approval-card/AiChip";
import {
  CHIPS_CLASS_NAME, FACTS_GRID_CLASS_NAME, GROUP_CLASS_NAME, HEADER_ACTIONS_CLASS_NAME, HEADER_CLASS_NAME, ITEM_CLASS_NAME,
  LIST_CLASS_NAME, QUOTE_CLASS_NAME, STACK_CLASS_NAME,
} from "./classNames";

type ContextPanelProps = { readonly detail: LeadDetail };

const toBullets = (summary: string): ReadonlyArray<string> =>
  summary
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.startsWith("- "))
    .map((line) => line.slice(2).trim())
    .filter((line) => line.length > 0);

const SIGNAL_PATTERN = /^(urgency|risk)\s*:\s*(.+)$/i;

/** Icon that matches the first word of a brief line. */
const bulletIcon = (text: string): IconName => {
  const head = text.toLowerCase();
  if (head.startsWith("urgency")) return "streak";
  if (head.startsWith("risk")) return "support";
  if (head.startsWith("pain")) return "pending";
  if (head.startsWith("budget")) return "wallet";
  return "complete";
};

type Signal = { readonly id: string; readonly label: string };

const toSignals = (bullets: ReadonlyArray<string>, labels: { readonly Urgency: string; readonly Risk: string }): ReadonlyArray<Signal> =>
  bullets.flatMap((item, index): Array<Signal> => {
    const match = SIGNAL_PATTERN.exec(item);
    if (match === null) return [];
    const kind = (match[1] ?? "").toLowerCase() === "urgency" ? "Urgency" : "Risk";
    const value = (match[2] ?? "").split(/[—–;.]/)[0]?.trim() ?? "";
    return [{ id: `${index}-${kind}`, label: `${labels[kind]}: ${value}` }];
  });

/** P02: customer context with the AI-prepared brief, signals and refresh / copy actions. */
export const ContextPanel = ({ detail }: ContextPanelProps) => {
  const { lead, events } = detail;
  const t = useT(leadDict);
  const locale = useLocale();
  const formatCaptured = (iso: string): string =>
    new Intl.DateTimeFormat(intlLocale(locale), { dateStyle: "medium", timeStyle: "short", timeZone: TIME_ZONE }).format(new Date(iso));
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [isCopied, setIsCopied] = useState(false);

  const onRefresh = () => {
    setError(null);
    startTransition(async () => {
      const result = await refreshContext(lead.id);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      router.refresh();
    });
  };

  const summary = lead.context_summary;
  const hasBrief = summary !== null && summary.trim().length > 0;
  const bullets = hasBrief ? toBullets(summary) : [];
  const signals = toSignals(bullets, { Urgency: t("signalUrgency"), Risk: t("signalRisk") });
  const preparedAt = [...events]
    .filter((event) => event.kind === "context.summarised")
    .sort((a, b) => b.created_at.localeCompare(a.created_at))[0]?.created_at;
  const hasConversation = events.some((event) => event.kind === "lead.captured" && event.evidence !== null);

  const onCopy = () => {
    if (!hasBrief) return;
    const text = `${lead.contact_name} — ${lead.company}\n${t("copyNeed")}: ${lead.need}\n\n${summary}`;
    navigator.clipboard
      .writeText(text)
      .then(() => {
        setIsCopied(true);
        window.setTimeout(() => setIsCopied(false), 2000);
      })
      .catch(() => setError(t("copyFailed")));
  };

  const brief = hasBrief ? (
    <>
      <div className={GROUP_CLASS_NAME}>
        <div className={HEADER_ACTIONS_CLASS_NAME}>
          <Heading level={3}>{t("contextBrief")}</Heading>
          <AiChip />
        </div>
        {bullets.length > 0 ? (
          <ul className={LIST_CLASS_NAME}>
            {bullets.map((item, index) => (
              <li key={`${index}-${item}`} className={ITEM_CLASS_NAME}>
                <Icon source={nivoIconSource(bulletIcon(item), "chip")} usage="chip" />
                <Text as="span">{item}</Text>
              </li>
            ))}
          </ul>
        ) : (
          <Text>{summary}</Text>
        )}
      </div>
      {signals.length > 0 ? (
        <div className={GROUP_CLASS_NAME}>
          <Heading level={3}>{t("signals")}</Heading>
          <div className={CHIPS_CLASS_NAME}>
            {signals.map((signal) => (
              <Badge key={signal.id} tone="warning">{signal.label}</Badge>
            ))}
          </div>
        </div>
      ) : null}
    </>
  ) : (
    <EmptyNotice
      message={t("noBrief")}
      description={t("noBriefHint")}
      actionLabel={t("prepareContext")}
      actionVariant="secondary"
      isActionPending={isPending}
      onAction={onRefresh}
    />
  );

  return (
    <SurfaceCard label={t("contextTitle")}>
      <div className={STACK_CLASS_NAME}>
        <div className={HEADER_CLASS_NAME}>
          <div className={HEADER_ACTIONS_CLASS_NAME}>
            {hasBrief ? <AiChip /> : null}
            <Text size="sm" tone="muted">
              {hasBrief ? t("preparedBy", { time: formatCaptured(preparedAt ?? lead.created_at) }) : t("notPrepared")}
            </Text>
          </div>
          <div className={HEADER_ACTIONS_CLASS_NAME}>
            {hasConversation ? <Button variant="ghost" size="sm" href="#history">{t("viewConversation")}</Button> : null}
            {hasBrief ? <Button variant="outline" size="sm" onPress={onCopy}>{isCopied ? t("briefCopied") : t("copyBrief")}</Button> : null}
            {hasBrief ? <Button variant="outline" size="sm" isPending={isPending} onPress={onRefresh}>{t("refreshContext")}</Button> : null}
          </div>
        </div>
        <div className={FACTS_GRID_CLASS_NAME}>
          <DescriptionList
            layout="stacked"
            isDivided
            items={[
              { id: "contact", term: t("factContact"), description: lead.contact_name },
              { id: "company", term: t("factCompany"), description: lead.company },
            ]}
          />
          <DescriptionList
            layout="stacked"
            isDivided
            items={[
              { id: "channel", term: t("factChannel"), description: lead.channel },
              { id: "captured", term: t("factCaptured"), description: formatCaptured(lead.created_at) },
            ]}
          />
        </div>
        <div className={GROUP_CLASS_NAME}>
          <Heading level={3}>{t("customerWords")}</Heading>
          <blockquote className={QUOTE_CLASS_NAME}>
            <Text>{lead.need}</Text>
          </blockquote>
        </div>
        {brief}
        {error === null ? null : <Alert tone="negative" title={t("somethingWrong")} description={error} />}
      </div>
    </SurfaceCard>
  );
};
