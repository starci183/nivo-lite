import type { BadgeTone } from "@starci/grammar/common"
import type { AgentWorkTurnView, AgentWorkTurnsView } from "@/modules/types"
import { relative, workItemHrefOf } from "./agentWork.wire"
import { reasonWord, sourceWord } from "./agentWork.words"
import type { AgentWorkContext, AgentWorkTranslator, TurnWire } from "./agentWork.wire"

/** What a turn did, in words, with the tone of its badge. */
interface Outcome {
    readonly label: string
    readonly tone: BadgeTone
}

/** A held wake with its plain reason; only the outcome when the table has none. */
const heldLabel = (t: AgentWorkTranslator, reason: string | null | undefined): string => {
    const why = reasonWord(t, reason)
    return why === "" ? t("outcomeHeldPlain") : t("outcomeHeld", { why })
}

/** A skipped wake with its plain reason; only the outcome when the table has none. */
const skippedLabel = (t: AgentWorkTranslator, reason: string | null | undefined): string => {
    const why = reasonWord(t, reason)
    return why === "" ? t("outcomeSkippedPlain") : t("outcomeSkipped", { why })
}

const outcomeOf = (wire: TurnWire, t: AgentWorkTranslator): Outcome => {
    if (wire.status === "running") return { label: t("outcomeRunning"), tone: "accent" }
    if (wire.wakeStatus === "failed" || wire.wakeStatus === "dead" || wire.status === "failed") {
        return { label: t("outcomeFailed"), tone: "danger" }
    }
    if (wire.wakeStatus === "held") return { label: heldLabel(t, wire.reason), tone: "warning" }
    if (wire.wakeStatus === "skipped") return { label: skippedLabel(t, wire.reason), tone: "neutral" }
    if (wire.workItemId !== null && wire.workItemId !== undefined)
        return { label: t("outcomeWorkItem"), tone: "success" }
    if (wire.status === "proposed") return { label: t("outcomeProposed"), tone: "accent" }
    return { label: t("outcomeDone"), tone: "success" }
}

/** How long a turn took, when it is known. Tokens and raw cost are not shown to the owner. */
const durationOf = (wire: TurnWire, context: AgentWorkContext): string => {
    if (wire.durationMs === null || wire.durationMs === undefined) return ""
    const seconds = Math.max(1, Math.round(wire.durationMs / 1000))
    return context.t("usageSeconds", { n: context.format.number(seconds) })
}

const isQuiet = (wire: TurnWire): boolean => wire.wakeStatus === "skipped" && wire.reason === "no_work"

const toTurnView = (wire: TurnWire, context: AgentWorkContext): AgentWorkTurnView => {
    const outcome = outcomeOf(wire, context.t)
    return {
        id: wire.id,
        sourceLabel: sourceWord(context.t, wire.source),
        outcomeLabel: outcome.label,
        outcomeTone: outcome.tone,
        wokeLabel: relative(context, wire.wokeAt),
        durationLabel: durationOf(wire, context),
        workItemHref: workItemHrefOf(context, wire.workItemId),
    }
}

/** The turn list: the wakes that found nothing to do are one count. */
export const toTurnsView = (wires: ReadonlyArray<TurnWire>, context: AgentWorkContext): AgentWorkTurnsView => {
    const quiet = wires.filter(isQuiet).length
    return {
        rows: wires.filter((wire) => !isQuiet(wire)).map((wire) => toTurnView(wire, context)),
        quietLabel: quiet === 0 ? "" : context.t("quietWakes", { n: quiet }),
    }
}
