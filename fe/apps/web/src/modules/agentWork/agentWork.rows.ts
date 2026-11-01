import type { AgentWorkGoalView, AgentWorkPreset, AgentWorkTaskView, AgentWorkTriggerView } from "@/modules/types"
import { maskPhones } from "@/modules/utils"
import { presetOf, relative, workItemHrefOf } from "./agentWork.wire"
import type { AgentWorkContext, AgentWorkTranslator, GoalWire, TaskWire, TriggerWire } from "./agentWork.wire"

/** The sentence a preset reads as. */
const presetSentence = (t: AgentWorkTranslator, preset: AgentWorkPreset | null, atTime: string): string => {
    if (preset === "every_15m") return t("presetEvery15m")
    if (preset === "hourly") return t("presetHourly")
    if (preset === "daily_at") return t("presetDailyAt", { time: atTime })
    if (preset === "weekdays_at") return t("presetWeekdaysAt", { time: atTime })
    return t("presetUnknown")
}

/** One trigger as a sentence, with the next run in words. */
export const toTriggerView = (wire: TriggerWire, context: AgentWorkContext): AgentWorkTriggerView => {
    const preset = presetOf(wire.preset)
    const atTime = wire.atTime ?? ""
    const when =
        wire.kind === "event"
            ? context.t("triggerEvent", { event: wire.eventName ?? "" })
            : presetSentence(context.t, preset, atTime)
    const hasProbe = wire.probeKey !== null && wire.probeKey !== undefined
    return {
        id: wire.id,
        sentence: hasProbe ? context.t("triggerWithProbe", { when }) : when,
        nextRunLabel: wire.enabled ? relative(context, wire.nextRunAt) : "",
        isEnabled: wire.enabled,
        isRemovable: wire.seedKey === null || wire.seedKey === undefined,
        kind: wire.kind,
        preset,
        atTime,
        timeZone: wire.timeZone,
        eventName: wire.eventName ?? "",
        probeKey: wire.probeKey ?? "",
    }
}

const goalStatusLabel = (t: AgentWorkTranslator, status: string): string => {
    if (status === "active") return t("goalActive")
    if (status === "paused") return t("goalPaused")
    if (status === "done") return t("goalDone")
    return t("goalDropped")
}

const goalSourceLabel = (t: AgentWorkTranslator, source: string): string => {
    if (source === "owner") return t("sourceOwner")
    if (source === "module") return t("sourceModule")
    return t("sourceAgent")
}

/** One goal in words. */
export const toGoalView = (wire: GoalWire, context: AgentWorkContext): AgentWorkGoalView => {
    const due = relative(context, wire.dueAt)
    return {
        id: wire.id,
        title: maskPhones(wire.title),
        detail: maskPhones(wire.detail),
        statusLabel: goalStatusLabel(context.t, wire.status),
        dueLabel: due === "" ? "" : context.t("goalDue", { when: due }),
        isOpen: wire.status === "active" || wire.status === "paused",
        source: goalSourceLabel(context.t, wire.source),
    }
}

const waitingOnLabel = (t: AgentWorkTranslator, waitingOn: string | null | undefined): string => {
    if (waitingOn === "approval") return t("waitApproval")
    if (waitingOn === "member") return t("waitMember")
    if (waitingOn === "event") return t("waitEvent")
    return ""
}

const waitLabelOf = (wire: TaskWire, context: AgentWorkContext): string => {
    const { t } = context
    const next = relative(context, wire.nextActionAt)
    const on = waitingOnLabel(t, wire.waitingOn)
    if (on !== "" && next !== "") return t("waitWithNext", { on, next })
    if (on !== "") return on
    return next === "" ? "" : t("waitNext", { next })
}

/** One task in words, with what it waits for and the way to its work item. */
export const toTaskView = (wire: TaskWire, context: AgentWorkContext): AgentWorkTaskView => ({
    id: wire.id,
    title: maskPhones(wire.title),
    detail: maskPhones(wire.detail),
    statusLabel: wire.status === "waiting" ? context.t("taskWaiting") : context.t("taskOpen"),
    waitLabel: waitLabelOf(wire, context),
    workItemHref: workItemHrefOf(context, wire.workItemId),
})
