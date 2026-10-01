"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Badge, Button, EmptyNotice, SurfaceCard, Text, type BadgeTone } from "@starci/grammar/common";
import { useLocale, useT } from "@/i18n/client";
import { workbenchSales } from "@/i18n/dict/workbenchSales";
import type { WorkStatus } from "@/lib/flow-types";
import type { HandoffRow } from "@/lib/workbench-sales";
import { handoffToAccounting } from "./actions";
import { CHIPS_CLASS_NAME, LIST_CLASS_NAME, QUOTE_CLASS_NAME, ROW_ACTIONS_CLASS_NAME, ROW_CLASS_NAME, ROW_MAIN_CLASS_NAME } from "./classNames";
import { formatDate, formatVnd } from "./format";

const INVOICE_TONE: Record<string, BadgeTone> = { draft: "neutral", issued: "accent", paid: "success", void: "danger" };

/** Props for {@link HandoffsPanel}. */
export type HandoffsPanelProps = { readonly rows: ReadonlyArray<HandoffRow> };

const HandoffItem = ({ row }: { readonly row: HandoffRow }) => {
  const t = useT(workbenchSales);
  const locale = useLocale();
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [note, setNote] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const isFailed = row.work?.status === "failed" && !row.invoice;
  const canRun = row.orderId !== null && row.orderStatus === "confirmed" && !row.invoice && (row.canHandoff || isFailed);

  const run = () => {
    if (!row.orderId) return;
    const id = row.orderId;
    setError(null);
    setNote(null);
    startTransition(async () => {
      const result = await handoffToAccounting(id).catch((e: unknown) => ({ ok: false as const, error: e instanceof Error ? e.message : "" }));
      if (result.ok) {
        setNote(t(`handoffResult_${result.data.status}`));
        router.refresh();
      } else setError(t("actionFailed", { error: result.error }));
    });
  };

  const workLine = (status: WorkStatus | undefined): string | null => {
    if (!status || row.invoice) return null;
    return t(`work_${status}`);
  };
  const workText = workLine(row.work?.status);

  return (
    <li className={ROW_CLASS_NAME}>
      <div className={ROW_MAIN_CLASS_NAME}>
        <div className={CHIPS_CLASS_NAME}>
          <Badge tone={row.orderStatus === "won_without_order" ? "neutral" : "success"}>{t(`order_${row.orderStatus}`)}</Badge>
          {row.invoice ? (
            <Badge tone={INVOICE_TONE[row.invoice.status] ?? "neutral"} isDot>{t(`invoice_${row.invoice.status}`)}</Badge>
          ) : (
            <Badge tone={row.work?.status === "failed" ? "danger" : "warning"} isDot>{t("invoiceNone")}</Badge>
          )}
          {row.confirmedAt ? <Text as="span" size="xs" tone="muted">{formatDate(row.confirmedAt, locale)}</Text> : null}
        </div>
        {row.leadId ? (
          <Link href={`/leads/${row.leadId}`}>
            <Text as="span" weight="semibold">{row.customer}</Text>
          </Link>
        ) : (
          <Text weight="semibold">{row.customer}</Text>
        )}
        <Text size="sm" tone="muted" overflow="clamp-2">{[row.orderNo, row.items].filter(Boolean).join(" · ")}</Text>
        <Text size="sm" weight="semibold">{formatVnd(row.invoice?.amountVnd ?? row.amountVnd, locale)}</Text>
        {row.invoice ? <Text size="xs" tone="muted">{t("invoiceLine", { no: row.invoice.no })}</Text> : null}
        {workText ? <Text size="sm" weight="medium">{workText}</Text> : null}
        {isFailed && row.work?.error ? (
          <div className={QUOTE_CLASS_NAME}>
            <Text size="xs" tone="muted" weight="medium">{t("errorLabel")}</Text>
            <Text as="p" size="sm">{row.work.error}</Text>
          </div>
        ) : null}
        {row.orderStatus === "won_without_order" && !row.work ? <Text size="sm" tone="muted">{t("wonNoOrderHint")}</Text> : null}
        {note ? <Text size="sm" weight="medium" live="polite">{note}</Text> : null}
        {error ? <Text size="sm" live="assertive">{error}</Text> : null}
      </div>
      {canRun ? (
        <div className={ROW_ACTIONS_CLASS_NAME}>
          <Button variant="primary" size="sm" isPending={isPending} isDisabled={isPending} onPress={run}>{isFailed ? t("handoffRetry") : t("handoff")}</Button>
        </div>
      ) : null}
    </li>
  );
};

/** Surface 4: confirmed orders and where their invoice stands. A confirmed order with no invoice can be handed to Accounting. */
export const HandoffsPanel = ({ rows }: HandoffsPanelProps) => {
  const t = useT(workbenchSales);
  return (
    <>
      <Text size="sm" tone="muted">{t("handoffIntro")}</Text>
      <SurfaceCard ariaLabel={t("tab_handoff")}>
        {rows.length === 0 ? (
          <EmptyNotice message={t("handoffEmptyTitle")} description={t("handoffEmptyBody")} />
        ) : (
          <ul className={LIST_CLASS_NAME}>{rows.map((row) => <HandoffItem key={row.key} row={row} />)}</ul>
        )}
      </SurfaceCard>
    </>
  );
};
