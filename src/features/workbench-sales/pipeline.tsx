"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import Link from "next/link";
import { Badge, Button, Dialog, Text, Textarea } from "@starci/grammar/common";
import { useLocale, useT } from "@/i18n/client";
import { workbenchSales } from "@/i18n/dict/workbenchSales";
import { recordOutcome } from "@/lib/actions";
import type { LeadStage } from "@/lib/types";
import type { SalesDeal } from "@/lib/workbench-sales";
import { BOARD_CLASS_NAME, CARD_CLASS_NAME, CHIPS_CLASS_NAME, FORM_CLASS_NAME, LANE_BODY_CLASS_NAME, LANE_CLASS_NAME, LANE_HEAD_CLASS_NAME, STAGE_CHOICES_CLASS_NAME } from "./classNames";
import { formatDate, formatVnd, formatVndCompact } from "./format";
import { stageTone } from "./parts";

const STAGES: ReadonlyArray<LeadStage> = ["new", "qualified", "proposal", "won", "lost"];
const OPEN_LANES: ReadonlyArray<LeadStage> = ["new", "qualified", "proposal"];
const MIN_REASON_CHARS = 5;
const isClosing = (s: LeadStage): boolean => s === "won" || s === "lost";

/** Props for {@link PipelinePanel}. */
export type PipelinePanelProps = {
  readonly deals: ReadonlyArray<SalesDeal>;
  readonly closedHidden: { readonly won: number; readonly lost: number };
};

type MoveDialogProps = { readonly deal: SalesDeal | null; readonly onClose: () => void };

/** Confirm a stage move. Closing a deal (won or lost) asks for a reason that is kept as the outcome evidence. */
const MoveDialog = ({ deal, onClose }: MoveDialogProps) => {
  const t = useT(workbenchSales);
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [target, setTarget] = useState<LeadStage | null>(null);
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);

  const close = () => {
    setTarget(null);
    setReason("");
    setError(null);
    onClose();
  };
  const needsReason = target !== null && isClosing(target);
  const reasonLength = reason.trim().length;
  const isIncomplete = target === null || (needsReason && reasonLength < MIN_REASON_CHARS);

  const confirm = () => {
    if (!deal || !target) return;
    setError(null);
    startTransition(async () => {
      const result = await recordOutcome(deal.leadId, target, reason.trim()).catch((e: unknown) => ({ ok: false as const, error: e instanceof Error ? e.message : "" }));
      if (result.ok) {
        close();
        router.refresh();
      } else setError(t("actionFailed", { error: result.error }));
    });
  };

  return (
    <Dialog
      isOpen={deal !== null}
      onOpenChange={(open) => {
        if (!open) close();
      }}
      title={deal ? t("moveTitle", { name: deal.customer }) : t("moveTitleFallback")}
      description={deal ? t("moveCurrent", { stage: t(`stage_${deal.stage}`) }) : undefined}
      size="md"
      closeLabel={t("cancel")}
      footer={
        <>
          <Button variant="tertiary" onPress={close}>{t("cancel")}</Button>
          <Button variant={target === "lost" ? "danger" : "primary"} isPending={isPending} isDisabled={isIncomplete || isPending} onPress={confirm}>{t("moveConfirm")}</Button>
        </>
      }
    >
      <div className={FORM_CLASS_NAME}>
        <Text size="sm" weight="medium">{t("moveTo")}</Text>
        <div className={STAGE_CHOICES_CLASS_NAME} role="group" aria-label={t("moveTo")}>
          {STAGES.filter((s) => deal && s !== deal.stage).map((s) => (
            <Button key={s} variant={target === s ? "primary" : "outline"} size="sm" onPress={() => setTarget(s)}>{t(`stage_${s}`)}</Button>
          ))}
        </div>
        {target ? (
          <Textarea
            label={needsReason ? t(target === "won" ? "reasonWonLabel" : "reasonLostLabel") : t("noteLabel")}
            description={needsReason ? t("reasonHint", { n: MIN_REASON_CHARS }) : undefined}
            isRequired={needsReason}
            rows={3}
            value={reason}
            isDisabled={isPending}
            onValueChange={setReason}
          />
        ) : null}
        {target === "won" ? <Text size="sm" tone="muted">{t("moveWonNote")}</Text> : null}
        {error ? <Text size="sm" live="assertive">{error}</Text> : null}
      </div>
    </Dialog>
  );
};

const DealCard = ({ deal, onMove }: { readonly deal: SalesDeal; readonly onMove: (deal: SalesDeal) => void }) => {
  const t = useT(workbenchSales);
  const locale = useLocale();
  const closed = deal.stage === "won" || deal.stage === "lost";
  return (
    <li className={CARD_CLASS_NAME}>
      <Link href={`/leads/${deal.leadId}`}>
        <Text as="span" weight="semibold">{deal.customer}</Text>
      </Link>
      {deal.company ? <Text size="xs" tone="muted">{deal.company}</Text> : null}
      <div className={CHIPS_CLASS_NAME}>
        <Text as="span" size="sm" weight="semibold">{deal.valueVnd !== null ? formatVnd(deal.valueVnd, locale) : t("noValue")}</Text>
        {deal.valueSource ? <Badge tone="neutral">{t(deal.valueSource === "order" ? "valueOrder" : "valueQuote")}</Badge> : null}
      </div>
      {closed ? (
        <Text size="sm" tone="muted" overflow="clamp-2">{deal.closedReason ? t("closedReason", { reason: deal.closedReason }) : t("closedNoReason")}</Text>
      ) : (
        <Text size="sm" overflow="clamp-2">{deal.nextStep ? t("nextStep", { step: deal.nextStep }) : t("nextStepNone")}</Text>
      )}
      <Text size="xs" tone="muted">
        {[deal.owner ? t("owner", { name: deal.owner }) : t("ownerNone"), deal.dueAt && !closed ? t("due", { date: formatDate(deal.dueAt, locale) }) : null].filter(Boolean).join(" · ")}
      </Text>
      <div>
        <Button variant="tertiary" size="sm" onPress={() => onMove(deal)}>{t("moveButton")}</Button>
      </div>
    </li>
  );
};

type LaneProps = { readonly title: string; readonly deals: ReadonlyArray<SalesDeal>; readonly hidden?: number; readonly tone: ReturnType<typeof stageTone>; readonly onMove: (deal: SalesDeal) => void };

const Lane = ({ title, deals, hidden = 0, tone, onMove }: LaneProps) => {
  const t = useT(workbenchSales);
  const locale = useLocale();
  const total = deals.reduce((s, d) => s + (d.valueVnd ?? 0), 0);
  return (
    <section className={LANE_CLASS_NAME} aria-label={title}>
      <div className={LANE_HEAD_CLASS_NAME}>
        <div className={CHIPS_CLASS_NAME}>
          <Badge tone={tone} isDot>{title}</Badge>
          <Text as="span" size="xs" tone="muted">{deals.length + hidden}</Text>
        </div>
        {total > 0 ? <Text as="span" size="xs" tone="muted">{formatVndCompact(total, locale)}</Text> : null}
      </div>
      {deals.length === 0 ? (
        <Text size="sm" tone="muted">{t("laneEmpty")}</Text>
      ) : (
        <ul className={LANE_BODY_CLASS_NAME}>{deals.map((d) => <DealCard key={d.leadId} deal={d} onMove={onMove} />)}</ul>
      )}
      {hidden > 0 ? <Text size="xs" tone="muted">{t("laneMore", { n: hidden })}</Text> : null}
    </section>
  );
};

/** Surface 2: the pipeline by stage. Moving a card is always confirmed; won and lost keep the reason. */
export const PipelinePanel = ({ deals, closedHidden }: PipelinePanelProps) => {
  const t = useT(workbenchSales);
  const [moving, setMoving] = useState<SalesDeal | null>(null);
  const by = (s: LeadStage) => deals.filter((d) => d.stage === s);
  return (
    <>
      <div className={BOARD_CLASS_NAME}>
        {OPEN_LANES.map((s) => <Lane key={s} title={t(`stage_${s}`)} deals={by(s)} tone={stageTone(s)} onMove={setMoving} />)}
        <Lane title={t("stage_won")} deals={by("won")} hidden={closedHidden.won} tone="success" onMove={setMoving} />
        <Lane title={t("stage_lost")} deals={by("lost")} hidden={closedHidden.lost} tone="danger" onMove={setMoving} />
      </div>
      <MoveDialog key={moving?.leadId ?? "none"} deal={moving} onClose={() => setMoving(null)} />
    </>
  );
};
