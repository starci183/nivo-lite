"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Badge, Button, DropdownMenu, Text } from "@starci/grammar/common";
import type { BadgeTone, DropdownMenuEntry } from "@starci/grammar/common";
import { nivoIconSource, TileIcon, type IconName } from "@/ui";
import { useT } from "@/i18n/client";
import { responsibilities } from "@/i18n/dict/responsibilities";
import { draftExecution } from "@/lib/actions";
import type { ResponsibilityRowModel } from "./format";
import { ROW_ACTIONS_CLASS_NAME, ROW_BODY_CLASS_NAME, ROW_CLASS_NAME, ROW_META_CLASS_NAME, ROW_TITLE_CLASS_NAME } from "./classNames";

const STATUS_TONES: Record<ResponsibilityRowModel["status"], BadgeTone> = {
  open: "neutral",
  waiting_approval: "accent",
  done: "success",
};

const STATUS_ICONS: Record<ResponsibilityRowModel["status"], IconName> = {
  open: "pending",
  waiting_approval: "review",
  done: "complete",
};

/** Props for {@link ResponsibilityRow}. */
export type ResponsibilityRowProps = { row: ResponsibilityRowModel };

/** One responsibility as a card: tile, title with status, customer, owner and due, Open and a real actions menu. */
export const ResponsibilityRow = (props: ResponsibilityRowProps) => {
  const { row } = props;
  const t = useT(responsibilities);
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const draft = () => {
    setError(null);
    startTransition(async () => {
      const outcome = await draftExecution(row.id);
      if (outcome.ok) router.refresh();
      else setError(outcome.error);
    });
  };

  const copyLink = () => {
    void navigator.clipboard
      .writeText(`${window.location.origin}/leads/${row.leadId}`)
      .then(() => {
        setCopied(true);
        window.setTimeout(() => {
          setCopied(false);
        }, 2000);
      })
      .catch(() => {
        setError(t("linkCopyFailed"));
      });
  };

  const entries: DropdownMenuEntry[] = [
    { id: "open", label: t("menuOpenLead"), href: `/leads/${row.leadId}`, iconSource: nivoIconSource("next", "leading") },
    { id: "office", label: t("menuOffice"), href: "/chat", iconSource: nivoIconSource("community", "leading") },
    { id: "copy", label: t("menuCopy"), iconSource: nivoIconSource("saved", "leading"), onAction: copyLink },
  ];
  if (row.status === "open") {
    entries.push({
      kind: "section",
      id: "act",
      items: [
        {
          id: "draft",
          label: t("menuDraft"),
          description: row.ownerKind === "agent" ? t("menuDraftAgent", { name: row.ownerName }) : t("menuDraftHuman"),
          iconSource: nivoIconSource("send", "leading"),
          onAction: draft,
        },
      ],
    });
  }

  return (
    <li className={ROW_CLASS_NAME}>
        <TileIcon props={{ icon: STATUS_ICONS[row.status], signal: row.isOverdue ? "attention" : "none" }} />
        <div className={ROW_BODY_CLASS_NAME}>
          <div className={ROW_TITLE_CLASS_NAME}>
            <Text weight="semibold" overflow="truncate">{row.title}</Text>
            <Badge tone={STATUS_TONES[row.status]} isDot>{row.statusLabel}</Badge>
            {row.status === "waiting_approval" && row.ownerKind === "agent" ? <Badge tone="accent">{t("aiDraft")}</Badge> : null}
          </div>
          <Text size="sm" tone="muted" overflow="truncate">{row.customer}</Text>
          <div className={ROW_META_CLASS_NAME}>
            <Text size="xs" tone="muted">
              {`${t("owner")} `}
              <Text as="span" size="xs" weight="semibold">{row.ownerName}</Text>
            </Text>
            {row.dueLabel === null ? null : (
              <>
                <Text size="xs" tone="muted">·</Text>
                <Text size="xs" tone={row.isOverdue ? "accent" : "muted"} weight={row.isOverdue ? "semibold" : "normal"}>{row.dueLabel}</Text>
              </>
            )}
            {copied ? <Text size="xs" tone="muted">{`· ${t("linkCopied")}`}</Text> : null}
          </div>
          {row.status === "done" ? null : <Text size="sm" overflow="clamp-2">{t("next", { action: row.nextAction })}</Text>}
          {error === null ? null : <Text size="xs" tone="accent" live="polite">{error}</Text>}
        </div>
        <div className={ROW_ACTIONS_CLASS_NAME}>
          <Button variant="outline" href={`/leads/${row.leadId}`} endContent={<span aria-hidden="true">→</span>}>{t("open")}</Button>
          <DropdownMenu
            placement="bottom end"
            trigger={
              <Button variant="ghost" size="sm" isPending={isPending}>
                {isPending ? t("drafting") : t("more")}
              </Button>
            }
            entries={entries}
          />
        </div>
    </li>
  );
};
