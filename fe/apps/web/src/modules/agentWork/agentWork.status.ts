import type { AgentWorkStatusView, AgentWorkView } from "@/modules/types"
import { toGoalView, toTaskView, toTriggerView } from "./agentWork.rows"
import { toTurnsView } from "./agentWork.turns"
import { DEFAULT_TIME_ZONE, dateOf, relative } from "./agentWork.wire"
import type { AgentWorkContext, AgentWorkWire, TriggerWire } from "./agentWork.wire"

/** The earliest next run among the triggers that are on. */
const nextRunOf = (triggers: ReadonlyArray<TriggerWire>): string | null => {
    const times = triggers
        .filter((trigger) => trigger.enabled)
        .map((trigger) => dateOf(trigger.nextRunAt))
        .filter((at): at is number => at !== null)
    return times.length === 0 ? null : new Date(Math.min(...times)).toISOString()
}

/** The status band: working now, idle, paused, or breaker open; the next run in words; the queue. */
export const toStatusView = (wire: AgentWorkWire, context: AgentWorkContext): AgentWorkStatusView => {
    const { t } = context
    const breakerAt = dateOf(wire.state.breakerUntil)
    const isBreakerOpen = breakerAt !== null && breakerAt > context.now
    const isRunning = wire.turns.some((turn) => turn.status === "running")
    const next = relative(context, nextRunOf(wire.triggers))
    const base = {
        nextRunLabel: next === "" ? "" : t("nextRun", { when: next }),
        queueLabel: wire.pendingWakes === 0 ? "" : t("queue", { n: wire.pendingWakes }),
    }
    if (context.isWorkspaceOff) {
        return {
            ...base,
            kind: "workspaceOff",
            label: t("statusWorkspaceOff"),
            tone: "danger",
            stopNotice: t("noticeWorkspaceOff"),
        }
    }
    if (!wire.state.workEnabled) {
        return { ...base, kind: "off", label: t("statusOff"), tone: "danger", stopNotice: t("noticeOff") }
    }
    if (context.isPaused) {
        return { ...base, kind: "paused", label: t("statusPaused"), tone: "neutral", stopNotice: t("noticePaused") }
    }
    if (isBreakerOpen) {
        const when = relative(context, wire.state.breakerUntil)
        return {
            ...base,
            kind: "breaker",
            label: t("statusBreaker"),
            tone: "warning",
            stopNotice: t("noticeBreaker", { when }),
        }
    }
    if (isRunning) return { ...base, kind: "working", label: t("statusWorking"), tone: "success", stopNotice: "" }
    return { ...base, kind: "idle", label: t("statusIdle"), tone: "neutral", stopNotice: "" }
}

/** Everything the Work tab draws, from the answer of the back end. */
export const toWorkView = (wire: AgentWorkWire, context: AgentWorkContext): AgentWorkView => ({
    status: toStatusView(wire, context),
    goals: wire.goals.map((goal) => toGoalView(goal, context)),
    tasks: wire.tasks.map((task) => toTaskView(task, context)),
    triggers: wire.triggers.map((trigger) => toTriggerView(trigger, context)),
    turns: toTurnsView(wire.turns, context),
    canEdit: context.canEdit,
})

/** The view the tab draws while the answer is on its way: the same shape, one placeholder row in each list. */
export const WORK_PLACEHOLDER: AgentWorkView = {
    status: { kind: "idle", label: "-", tone: "neutral", nextRunLabel: "-", queueLabel: "-", stopNotice: "" },
    goals: [{ id: "goal", title: "-", detail: "-", statusLabel: "-", dueLabel: "", isOpen: true, source: "-" }],
    tasks: [{ id: "task", title: "-", detail: "-", statusLabel: "-", waitLabel: "", workItemHref: null }],
    triggers: [
        {
            id: "trigger",
            sentence: "-",
            nextRunLabel: "-",
            isEnabled: true,
            isRemovable: false,
            kind: "schedule",
            preset: null,
            atTime: "",
            timeZone: DEFAULT_TIME_ZONE,
            eventName: "",
            probeKey: "",
        },
    ],
    turns: {
        rows: [
            {
                id: "turn",
                sourceLabel: "-",
                outcomeLabel: "-",
                outcomeTone: "neutral",
                wokeLabel: "-",
                durationLabel: "",
                workItemHref: null,
            },
        ],
        quietLabel: "",
    },
    canEdit: false,
}
