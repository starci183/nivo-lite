import type { AgentWorkPreset, AgentWorkTaskView, AgentWorkTriggerView } from "@/modules/types"
import { maskPhones } from "@/modules/utils"
import {
    presetOf,
    relative,
    workItemHrefOf,
    type AgentWorkContext,
    type AgentWorkTranslator,
    type TaskWire,
    type TriggerWire,
} from "./agentWork.wire"
import { eventWord, plainText, taskStatusWord, waitingOnWord } from "./agentWork.words"

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
    return {
        id: wire.id,
        sentence: when,
        nextRunLabel: wire.enabled ? nextOf(context, wire.nextRunAt) : "",
        isEnabled: wire.enabled,
        isRemovable: wire.seedKey === null || wire.seedKey === undefined,
        kind: wire.kind,
        preset,
        atTime,
        timeZone: wire.timeZone,
        eventName: wire.eventName ?? "",
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

/** The title the engine gives a due care step ("care due <time>"): the time it is due. */
const CARE_DUE = /^care due (.+)$/u

/** The title and the line under it of a task: a due care step says a sentence and when it is due, any other task its own words. */
const taskWordsOf = (wire: TaskWire, context: AgentWorkContext): { readonly title: string; readonly detail: string } => {
    const care = CARE_DUE.exec(wire.title)
    if (care === null)
        return { title: maskPhones(plainText(context.t, wire.title)), detail: maskPhones(plainText(context.t, wire.detail)) }
    const when = relative(context, care[1])
    return { title: context.t("taskCareDue"), detail: when === "" ? "" : context.t("taskCareDueWhen", { when }) }
}

/** One task in words, with what it waits for and the way to its work item. */
export const toTaskView = (wire: TaskWire, context: AgentWorkContext): AgentWorkTaskView => ({
    id: wire.id,
    ...taskWordsOf(wire, context),
    statusLabel: taskStatusWord(context.t, wire.status),
    waitLabel: waitLabelOf(wire, context),
    workItemHref: workItemHrefOf(context, wire.workItemId),
})
