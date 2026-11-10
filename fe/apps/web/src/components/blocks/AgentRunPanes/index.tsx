"use client"

import { useTranslations } from "next-intl"
import { useMemo, useState } from "react"
import { usePaneCopy } from "@/hooks/paneFrame"
import { agentRunGridOf, useAgentRunAiCalls, useAgentRunDetail, useRunAsideWide } from "@/hooks/agentRuns"
import { useOverviewPhone } from "@/hooks/overview"
import { useSlotLabels } from "@/hooks/slot"
import { EMPTY_STEPS_MAP } from "@/hooks/workflowSteps"
import type { RunDetailView, RunStepView } from "@/modules/types"
import { AgentRunPanesBase, type AgentRunPanesCopy } from "./component"

/** The run of the instance the page shows. */
type AgentRunPanesProps = {
    readonly module: string
    readonly installationId: string
    readonly runId: string
}

/** What the page shows while its first read is under way: the shape of a run with nothing in it. */
const PLACEHOLDER: RunDetailView = {
    head: {
        id: "",
        title: "",
        shortId: "",
        status: "running",
        statusLabel: "",
        statusTone: "neutral",
        meta: "",
        workflowName: "",
        canvasTitle: "",
        stepCount: 0,
        versionLabel: "",
        workflowHref: "",
        isRetryNeutral: false,
        canResume: false,
        canCancel: false,
    },
    figures: [
        { id: "trigger", term: "", value: "", href: "" },
        { id: "status", term: "", value: "", href: "" },
        { id: "duration", term: "", value: "", href: "" },
        { id: "workflow", term: "", value: "", href: "" },
        { id: "credit", term: "", value: "", href: "" },
    ],
    steps: [],
    canvas: {
        nodes: [],
        edges: [],
        kinds: [],
        statusLabels: EMPTY_STEPS_MAP.statusLabels,
        legend: [],
        selectedId: null,
    },
    selected: null,
    decision: null,
    switches: [],
    selectedKey: "",
}

type Words = ReturnType<typeof useTranslations<"agentRuns">>

/** The words of the page of a run that do not come from the data. */
const copyOf = (t: Words): AgentRunPanesCopy => ({
    paneLabel: t("runPaneLabel"),
    stepsTitle: t("stepsTitle"),
    asideLabel: t("asideLabel"),
    closeAside: "",
    canvasTitle: t("canvasTitle"),
    decision: {
        group: t("decisionGroup"),
        term: t("decisionTerm"),
        approve: t("decideApprove"),
        retry: t("decideRetry"),
        reject: t("decideReject"),
    },
    openWorkflow: t("workflowOpen"),
    canvasNote: t("canvasNote"),
    canvasEmpty: t("canvasEmpty"),
    missing: t("runMissing"),
    stepEmpty: t("stepEmpty"),
    head: {
        ariaLabel: t("headLabel"),
        resume: t("resume"),
        switchLabel: t("switchLabel"),
        cancel: {
            label: t("cancelRun"),
            dialogTitle: t("cancelTitle"),
            note: t("cancelNote"),
            keepLabel: t("cancelKeep"),
            confirmLabel: t("cancelRun"),
        },
    },
    params: {
        pick: t("stepEmpty"),
        started: t("paramStarted"),
        ended: t("paramEnded"),
        attempt: t("paramAttempt"),
        error: t("errorTitle"),
        status: t("sumStatus"),
        inputs: t("paramsInputs"),
        outputs: t("paramsOutputs"),
        branches: t("paramsBranches"),
        noInputs: t("paramsNoInputs"),
        noOutputs: t("paramsNoOutputs"),
        noBranches: t("paramsNoBranches"),
        taken: t("branchTakenBadge"),
        missing: t("paramMissing"),
        masked: t("paramMasked"),
        sent: t("sentTitle"),
        sentAlt: (position) => t("sentAlt", { n: position }),
        log: t("logTitle"),
        decide: t("decide"),
    },
})

/** No steps yet: one shared empty list, so the step-name map keeps its identity across renders. */
const EMPTY_STEPS: ReadonlyArray<RunStepView> = []

/** The connected page of one run: reads it with the graph it ran on, keeps the selected step and runs a stopped run again. */
export const AgentRunPanes = (props: AgentRunPanesProps) => {
    const t = useTranslations("agentRuns")
    const slotLabels = useSlotLabels()
    const isPhone = useOverviewPhone()
    const run = useAgentRunDetail(props.module, props.installationId, props.runId)
    const steps = "items" in run.slot ? run.slot.items.steps : EMPTY_STEPS
    const stepLabels = useMemo(() => new Map(steps.map((step) => [step.nodeKey, step.label])), [steps])
    const aiCalls = useAgentRunAiCalls(props.installationId, props.runId, stepLabels)
    const pane = usePaneCopy()
    const [isAsideOpen, setIsAsideOpen] = useState(false)
    const isWide = useRunAsideWide()
    const selected = "items" in run.slot ? run.slot.items.selected : null
    return (
        <AgentRunPanesBase
            props={{
                copy: { ...copyOf(t), closeAside: pane.closeAside },
                slot: run.slot,
                placeholder: PLACEHOLDER,
                slotLabels: slotLabels(t("runMissing")),
                isPhone,
                isMissing: run.isMissing,
                isResuming: run.isResuming,
                isCancelling: run.isCancelling,
                isDeciding: run.isDeciding,
                isAsideOpen,
                asideHead: {
                    title: selected?.title ?? t("asideLabel"),
                    description: selected?.kindLabel ?? "",
                },
                grid: agentRunGridOf(),
                aiCalls: {
                    copy: {
                        title: t("aiTitle"),
                        kinds: t("aiKinds", { count: aiCalls.length }),
                        empty: t("aiEmpty"),
                        purpose: t("aiColPurpose"),
                        calls: t("aiColCalls"),
                        prompt: t("aiColPrompt"),
                        completion: t("aiColCompletion"),
                        time: t("aiColTime"),
                        cost: t("aiColCost"),
                        model: t("aiColModel"),
                    },
                    rows: aiCalls,
                },
            }}
            on={{
                select: run.select,
                pressStep: (nodeKey) => {
                    run.select(nodeKey)
                    if (!isWide) setIsAsideOpen(true)
                },
                asideOpenChange: setIsAsideOpen,
                resume: run.resume,
                cancel: run.cancel,
                decide: run.decide,
                retry: run.reload,
            }}
        />
    )
}
