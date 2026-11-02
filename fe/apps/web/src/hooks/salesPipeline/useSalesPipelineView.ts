"use client"

import { useFormatter, useTranslations } from "next-intl"
import { useState } from "react"
import { useLeadCommands } from "@/hooks/leads"
import { useFeatureLifetime, useFeatureReset } from "@/hooks/reuseables"
import { useSalesPipelineForm } from "@/hooks/rhf"
import { DEAL_STAGES } from "@/hooks/sales"
import { stageWordOf } from "@/hooks/salesworkbench"
import type { MoveDialogView, SalesWorkbenchData, LeadStageId } from "@/modules/types"
import { useGraphQLWithToast } from "@/modules/toast"
import { createSalesPipelineState, isClosing, isStage, LANES, MIN_REASON_CHARS } from "./salesPipeline.shared"
import type { PipelineOperation, SalesPipelineControllerInput } from "./salesPipeline.shared"

/** Owns the original move dialog's form and command lifetime while the pipeline tab is present. */
export const useSalesPipelineView = (data: SalesWorkbenchData | null, isActive: boolean, scope: string) => {
    const t = useTranslations("workbenchSales")
    const format = useFormatter()
    const commands = useLeadCommands()
    const runGraphQL = useGraphQLWithToast()
    const lifetime = useFeatureLifetime(isActive, scope)
    const form = useSalesPipelineForm()
    const { target: selectedTarget, reason } = form.watch()
    const [movingId, setMovingId] = useState<string | null>(null)
    const [operation, setOperation] = useState<PipelineOperation | null>(null)
    useFeatureReset({
        isActive,
        isReady: true,
        scope,
        onReset: () => {
            setMovingId(null)
            setOperation(null)
            form.reset({ target: "", reason: "" })
        },
    })
    const context = createPipelineActions({
        t,
        format,
        commands,
        runGraphQL,
        deals: data?.deals ?? [],
        closedHidden: data?.closedHidden ?? { won: 0, lost: 0 },
        form,
        reason,
        target: selectedTarget || null,
        isPending: operation?.scope === scope && operation.isCurrent(),
        movingId,
        setMovingId,
        scope,
        capture: lifetime.capture,
        setOperation,
    })
    return {
        props: {
            label: t("tab_pipeline"),
            lanes: LANES.map(context.laneOf),
            emptyText: t("laneEmpty"),
            moveLabel: t("moveButton"),
            cancelLabel: t("cancel"),
            confirmLabel: t("moveConfirm"),
            dialog: context.dialog,
            isPending: context.isPending,
        },
        on: {
            move: (leadId: string) => setMovingId(leadId),
            target: (value: string) => form.setValue("target", isStage(value) ? value : ""),
            reason: (value: string) => form.setValue("reason", value),
            confirm: context.confirm,
            close: context.close,
        },
    }
}

/** Keeps local form validation separate from the remote command and its origin-owned completion. */
const createPipelineActions = (input: SalesPipelineControllerInput) => {
    const context = createSalesPipelineState(input)
    const { t, commands, form, reason, target, setMovingId, moving, error, capture, setOperation, scope } = context
    const close = () => {
        setMovingId(null)
        form.reset({ target: "", reason: "" })
    }
    const confirm = () => {
        const pending = { scope, isCurrent: capture() }
        if (!pending.isCurrent() || moving === null || input.isPending) return
        setOperation(pending)
        const finish = () => setOperation((current) => (current === pending ? null : current))
        form.handleSubmit((values) => {
            if (!pending.isCurrent() || !isStage(values.target)) return finish()
            commands
                .recordOutcome(moving.leadId, values.target, values.reason)
                .then((result) => {
                    if (result !== undefined && pending.isCurrent()) close()
                })
                .catch((error: unknown) => input.runGraphQL(() => Promise.reject(error), { showSuccessToast: false }))
                .finally(finish)
        }, finish)().catch((error: unknown) =>
            input.runGraphQL(() => Promise.reject(error), { showSuccessToast: false }).finally(finish),
        )
    }
    const needsReason = target !== null && isClosing(target)
    const reasonLabelOf = (stage: LeadStageId | null): string | null => {
        if (stage === null) return null
        if (!needsReason) return t("noteLabel")
        return t(stage === "won" ? "reasonWonLabel" : "reasonLostLabel")
    }
    const dialog: MoveDialogView | null =
        moving === null
            ? null
            : {
                  title: t("moveTitle", { name: moving.customer }),
                  description: t("moveCurrent", { stage: stageWordOf(t, moving.stage) }),
                  options: DEAL_STAGES.filter((stage) => stage !== moving.stage).map((stage) => ({
                      value: stage,
                      label: stageWordOf(t, stage),
                  })),
                  target: target ?? "",
                  isDanger: target === "lost",
                  reasonLabel: reasonLabelOf(target),
                  reasonHint: needsReason ? t("reasonHint", { n: MIN_REASON_CHARS }) : undefined,
                  reasonRequired: needsReason,
                  reason,
                  wonNote: target === "won" ? t("moveWonNote") : null,
                  error,
                  isIncomplete: target === null || (needsReason && reason.trim().length < MIN_REASON_CHARS),
              }
    return { ...context, close, confirm, dialog }
}
