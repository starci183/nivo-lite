"use client"

import { useTranslations } from "next-intl"
import { documentsOfFact, keyDocumentsOf, mergedPairsOf, valueOf, type FactKey } from "@/modules/brain"
import type { InboxConflictRowView } from "@/modules/types"
import type { FactWords } from "./useFactWords"

/** What the conflict rows are read against: the keys, the topic of a document, and the words of the facts. */
export interface InboxConflictsInput {
    readonly keys: ReadonlyArray<FactKey>
    readonly topicOf: (sourceId: string) => string | undefined
    readonly words: FactWords
}

/** The conflicts of the inbox and the note of the values merged because they said the same thing. */
export interface InboxConflicts {
    readonly conflicts: ReadonlyArray<InboxConflictRowView>
    readonly mergedNote: string | null
}

/**
 * The values that differ, one row per subject and attribute: the competing values (and a stop) with how many documents and what is in
 * use; and, said once, the values that only differed in wording and were merged without asking.
 */
export const useInboxConflicts = (input: InboxConflictsInput): InboxConflicts => {
    const t = useTranslations("brainInbox")
    const { pick, drawer } = input.words
    const pairs = mergedPairsOf(input.keys.filter((one) => one.kind !== "settled"))
    const rowOf = (one: FactKey): InboxConflictRowView => {
        const doc = documentsOfFact(one.lead)[0]
        const values = [...one.options.map((entry) => valueOf(entry)), ...(one.retire === null ? [] : [drawer.retireOption])]
        return {
            id: one.key,
            title: `${one.lead.subjectLabel} · ${one.lead.attributeLabel}`,
            line: t("conflictRowLine", {
                values: pick.valuesOf(values),
                documents: keyDocumentsOf(one).length,
                state:
                    one.current === null ? t("conflictNoValue") : t("conflictInUse", { value: valueOf(one.current) }),
            }),
            badge: doc === undefined ? null : (input.topicOf(doc.id) ?? null),
        }
    }
    return {
        conflicts: input.keys.filter((one) => one.kind === "conflict").map((entry) => rowOf(entry)),
        mergedNote:
            pairs.length === 0
                ? null
                : t("mergedNote", {
                      count: pairs.length,
                      pairs: pairs.map((pair) => t("mergedPair", { kept: pair.kept, merged: pair.merged })).join(", "),
                  }),
    }
}
