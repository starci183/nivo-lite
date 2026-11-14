import { useTranslations } from "next-intl"
import { useMemo } from "react"
import type { BrainChangeWords } from "@/modules/teamChat"

/** The translator of the truth-change card words. */
type BrainChangeTranslator = ReturnType<typeof useTranslations<"brainChange">>

/** The clocks of the viewer and of the shop the card words are bound to. */
type BrainChangeClocks = Pick<BrainChangeWords, "timeOf" | "dateTimeOf" | "shopDateOf">

/** The title of a card by what it asks: change a truth, add one, or take one out. */
const titleOf = (t: BrainChangeTranslator, kind: string): string => {
    if (kind === "add") return t("title.add")
    return kind === "retire" ? t("title.retire") : t("title.change")
}

/** The chip of a card by where it stands; a state the web does not know reads as closed. */
const chipOf = (t: BrainChangeTranslator, state: string): ReturnType<BrainChangeWords["chipOf"]> => {
    switch (state) {
        case "open":
            return { label: t("chip.open"), tone: "accent" }
        case "applied":
            return { label: t("chip.applied"), tone: "success" }
        case "rejected":
            return { label: t("chip.rejected"), tone: "neutral" }
        case "kept_both":
        case "kept":
            return { label: t("chip.keptBoth"), tone: "success" }
        case "superseded":
            return { label: t("chip.superseded"), tone: "neutral" }
        default:
            return { label: t("chip.closed"), tone: "neutral" }
    }
}

/** What was pressed to close the card, as the trace says it; null for a card nobody closed. */
const pressedOf = (t: BrainChangeTranslator, state: string): string | null => {
    if (state === "applied") return t("pressed.applied")
    if (state === "rejected") return t("pressed.rejected")
    return state === "kept_both" || state === "kept" ? t("pressed.keptBoth") : null
}

/** The muted line of a card by where the proposal came from. */
const metaOf = (t: BrainChangeTranslator, origin: string, agent: string, time: string): string => {
    if (origin === "chat") return t("meta.chat", { agent, time })
    if (origin === "learning") return t("meta.learning", { agent, time })
    return origin === "document" ? t("meta.document", { agent, time }) : t("meta.other", { agent, time })
}

/** The words of the truth-change cards in the viewer's language, with the clocks of the viewer and of the shop. */
const brainChangeWordsOf = (t: BrainChangeTranslator, clocks: BrainChangeClocks): BrainChangeWords => ({
    titleOf: (kind) => titleOf(t, kind),
    chipOf: (state) => chipOf(t, state),
    current: t("current"),
    plannedFrom: (date) => t("plannedFrom", { date }),
    maybeReplaces: t("maybeReplaces"),
    proposed: t("proposed"),
    retired: t("retired"),
    versionOf: (version, source) => (version === null ? source : t("version", { version, source })),
    reason: t("reason"),
    rowsLabel: t("rowsLabel"),
    quotesLabel: t("quotesLabel"),
    traceLabel: t("traceLabel"),
    approve: t("approve"),
    reject: t("reject"),
    keepBoth: t("keepBoth"),
    pressedOf: (state) => pressedOf(t, state),
    supersededNote: t("supersededNote"),
    metaOf: (origin, agent, time) => metaOf(t, origin, agent, time),
    saidBy: (name, when) => t("saidBy", { name, when }),
    learnedFrom: (count) => t("learnedFrom", { count }),
    ...clocks,
})

/** The words of the truth-change cards in the viewer's language, bound to the clocks it is given. */
export const useBrainChangeWords = (clocks: BrainChangeClocks): BrainChangeWords => {
    const t = useTranslations("brainChange")
    return useMemo(() => brainChangeWordsOf(t, clocks), [t, clocks])
}
