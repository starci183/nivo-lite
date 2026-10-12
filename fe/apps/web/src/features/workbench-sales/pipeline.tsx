"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Badge, Button, Dialog, EmptyNotice, HorizontalScrollRegion, SegmentedControl, SurfaceListCard, Text, TextAction, Textarea } from "@starci/grammar/common";
import { useLocale, useT } from "@/i18n/client";
import { workbenchSales } from "@/i18n/dict/workbenchSales";
import { recordOutcome } from "@/lib/actions";
import type { LeadStage } from "@/lib/types";
import type { SalesDeal } from "@/lib/workbench-sales";
import { BOARD_CLASS_NAME, CHIPS_CLASS_NAME, DEAL_ROW_CLASS_NAME, FORM_CLASS_NAME, LANE_CLASS_NAME, ROW_ACTIONS_CLASS_NAME } from "./classNames";
import { formatDate, formatVnd, formatVndCompact } from "./format";

const STAGES: ReadonlyArray<LeadStage> = ["new", "qualified", "proposal", "won", "lost"];
const OPEN_LANES: ReadonlyArray<LeadStage> = ["new", "qualified", "proposal"];
const MIN_REASON_CHARS = 5;
const isClosing = (s: LeadStage): boolean => s === "won" || s === "lost";
const isStage = (v: string): v is LeadStage => (STAGES as ReadonlyArray<string>).includes(v);

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
        <SegmentedControl
          label={t("moveTo")}
          options={STAGES.filter((s) => deal && s !== deal.stage).map((s) => ({ value: s, label: t(`stage_${s}`) }))}
          value={target ?? ""}
          isDisabled={isPending}
          onValueChange={(v) => setTarget(isStage(v) ? v : null)}
        />
        {target ? (
          <Textarea
            label={needsReason ? t(target === "won" ? "reasonWonLabel" : "reasonLostLabel") : t("noteLabel")}
            description={needsReason ? t("reasonHint", { n: MIN_REASON_CHARS }) : undefined}
            isRequired={needsReason}
            variant="secondary"
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

const DealRow = ({ deal, onMove }: { readonly deal: SalesDeal; readonly onMove: (deal: SalesDeal) => void }) => {
  const t = useT(workbenchSales);
  const locale = useLocale();
  const closed = deal.stage === "won" || deal.stage === "lost";
  return (
    <li className={DEAL_ROW_CLASS_NAME}>
      <TextAction href={`/leads/${deal.leadId}`}>{deal.customer}</TextAction>
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
      <div className={ROW_ACTIONS_CLASS_NAME}>
        <Button variant="tertiary" size="sm" onPress={() => onMove(deal)}>{t("moveButton")}</Button>
      </div>
    </li>
  );
};

type LaneProps = { readonly title: string; readonly deals: ReadonlyArray<SalesDeal>; readonly hidden?: number; readonly onMove: (deal: SalesDeal) => void };

/** One stage: a labelled collection of deal rows (COLLECTION-1, SurfaceListCard). */
const Lane = ({ title, deals, hidden = 0, onMove }: LaneProps) => {
  const t = useT(workbenchSales);
  const locale = useLocale();
  const total = deals.reduce((s, d) => s + (d.valueVnd ?? 0), 0);
  const fact = total > 0 ? `${deals.length + hidden} · ${formatVndCompact(total, locale)}` : String(deals.length + hidden);
  return (
    <div className={LANE_CLASS_NAME}>
      <SurfaceListCard
        label={title}
        fact={fact}
        empty={<EmptyNotice message={t("laneEmpty")} />}
        footer={hidden > 0 ? <Text size="xs" tone="muted">{t("laneMore", { n: hidden })}</Text> : undefined}
      >
        {deals.map((d) => <DealRow key={d.leadId} deal={d} onMove={onMove} />)}
      </SurfaceListCard>
    </div>
  );
};

/** Surface 2: the pipeline by stage. Moving a card is always confirmed; won and lost keep the reason. */
export const PipelinePanel = ({ deals, closedHidden }: PipelinePanelProps) => {
  const t = useT(workbenchSales);
  const [moving, setMoving] = useState<SalesDeal | null>(null);
  const by = (s: LeadStage) => deals.filter((d) => d.stage === s);
  return (
    <>
      <HorizontalScrollRegion overflow="needed" aria-label={t("tab_pipeline")}>
        <div className={BOARD_CLASS_NAME}>
          {OPEN_LANES.map((s) => <Lane key={s} title={t(`stage_${s}`)} deals={by(s)} onMove={setMoving} />)}
          <Lane title={t("stage_won")} deals={by("won")} hidden={closedHidden.won} onMove={setMoving} />
          <Lane title={t("stage_lost")} deals={by("lost")} hidden={closedHidden.lost} onMove={setMoving} />
        </div>
      </HorizontalScrollRegion>
      <MoveDialog key={moving?.leadId ?? "none"} deal={moving} onClose={() => setMoving(null)} />
    </>
  );
};
