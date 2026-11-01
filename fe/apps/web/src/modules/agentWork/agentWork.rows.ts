import type { AgentWorkGoalView, AgentWorkPreset, AgentWorkTaskView, AgentWorkTriggerView } from "@/modules/types"
import { presetOf, relative, workItemHrefOf } from "./agentWork.wire"
import { eventWord, goalSourceWord, goalStatusWord, plainText, taskStatusWord, waitingOnWord } from "./agentWork.words"
import type { AgentWorkContext, AgentWorkTranslator, GoalWire, TaskWire, TriggerWire } from "./agentWork.wire"

/** The sentence a preset reads as. */
const presetSentence = (t: AgentWorkTranslator, preset: AgentWorkPreset | null, atTime: string): string => {
    if (preset === "every_15m") return t("presetEvery15m")
    if (preset === "hourly") return t("presetHourly")
    if (preset === "daily_at") return t("presetDailyAt", { time: atTime })
    if (preset === "weekdays_at") return t("presetWeekdaysAt", { time: atTime })
    return t("presetUnknown")
}

/** The next run of a trigger in words; none when it has none. */
const nextOf = (context: AgentWorkContext, at: unknown): string => {
    const when = relative(context, at)
    return when === "" ? "" : context.t("triggerNext", { when })
}

/** One trigger as a sentence, with the next run in words. */
export const toTriggerView = (wire: TriggerWire, context: AgentWorkContext): AgentWorkTriggerView => {
    const preset = presetOf(wire.preset)
    const atTime = wire.atTime ?? ""
    const when =
        wire.kind === "event"
            ? context.t("triggerEvent", { event: eventWord(context.t, wire.eventName) })
            : presetSentence(context.t, preset, atTime)
    const hasProbe = wire.probeKey !== null && wire.probeKey !== undefined
    return {
        id: wire.id,
        sentence: hasProbe ? context.t("triggerWithProbe", { when }) : when,
        nextRunLabel: wire.enabled ? nextOf(context, wire.nextRunAt) : "",
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

/** One goal in words. */
export const toGoalView = (wire: GoalWire, context: AgentWorkContext): AgentWorkGoalView => {
    const due = relative(context, wire.dueAt)
    return {
        id: wire.id,
        title: plainText(context.t, wire.title),
        detail: plainText(context.t, wire.detail),
        statusLabel: goalStatusWord(context.t, wire.status),
        dueLabel: due === "" ? "" : context.t("goalDue", { when: due }),
        isOpen: wire.status === "active" || wire.status === "paused",
        source: goalSourceWord(context.t, wire.source),
    }
}

const waitLabelOf = (wire: TaskWire, context: AgentWorkContext): string => {
    const { t } = context
    const next = relative(context, wire.nextActionAt)
    const on = waitingOnWord(t, wire.waitingOn)
    if (on !== "" && next !== "") return t("waitWithNext", { on, next })
    if (on !== "") return on
    return next === "" ? "" : t("waitNext", { next })
}

/** One task in words, with what it waits for and the way to its work item. */
export const toTaskView = (wire: TaskWire, context: AgentWorkContext): AgentWorkTaskView => ({
    id: wire.id,
    title: plainText(context.t, wire.title),
    detail: plainText(context.t, wire.detail),
    statusLabel: taskStatusWord(context.t, wire.status),
    waitLabel: waitLabelOf(wire, context),
    workItemHref: workItemHrefOf(context, wire.workItemId),
})
