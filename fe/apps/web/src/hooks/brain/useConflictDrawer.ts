"use client"

import { useState } from "react"
import { useTranslations } from "next-intl"
import { KEEP_CHOICE, RETIRE_CHOICE, conflictDrawerOf, type FactDrawerWords, type FactKey } from "@/modules/brain"
import type { BrainLens, ConflictDrawerView } from "@/modules/types"
import { useFactBatch, type FactOperation } from "./useFactBatch"
import { useFailureToast } from "./useFailureToast"

/** What the comparison is read against: the keys that ask for a choice, the agents, and whether the reader may decide. */
export interface ConflictDrawerInput {
    readonly keys: ReadonlyArray<FactKey>
    readonly lenses: ReadonlyArray<BrainLens>
    readonly canWrite: boolean
    readonly words: FactDrawerWords
}

/** What the comparison gives its block: the open drawer (null while closed) and what it does. */
export interface ConflictDrawerState {
    readonly view: ConflictDrawerView | null
    readonly on: {
        readonly open: (key: string) => void
        readonly close: () => void
        readonly choose: (id: string) => void
        readonly confirm: () => void
    }
}

/** The decision a choice sends: keep the value in force, stop using it, or use one value (every other value of the key is rejected). */
const operationOf = (one: FactKey, chosenId: string): FactOperation | null => {
    if (chosenId === KEEP_CHOICE) {
        return {
            kind: "keep",
            request: {
                subjectKey: one.lead.subjectKey,
                attribute: one.lead.attribute,
                installationId: one.lead.installationId,
            },
        }
    }
    if (chosenId === RETIRE_CHOICE)
        return one.retire === null ? null : { kind: "decide", request: { id: one.retire.id, action: "apply" } }
    return one.options.some((fact) => fact.id === chosenId)
        ? { kind: "decide", request: { id: chosenId, action: "choose" } }
        : null
}

/**
 * The comparison of one subject and attribute whose values differ, in a wide drawer: what the agent answers today, each value with its
 * quote, documents, trust and condition, which agents read it, and the one choice. Nothing is used until the owner chooses.
 */
export const useConflictDrawer = (input: ConflictDrawerInput): ConflictDrawerState => {
    const t = useTranslations("brainInbox")
    const batch = useFactBatch()
    const failed = useFailureToast()
    const [openKey, setOpenKey] = useState<string | null>(null)
    const [chosenId, setChosenId] = useState<string | null>(null)
    const one = input.keys.find((key) => key.key === openKey && key.kind === "conflict")
    const view =
        one === undefined
            ? null
            : conflictDrawerOf({
                  one,
                  lenses: input.lenses,
                  chosenId,
                  isPending: batch.isPending,
                  canWrite: input.canWrite,
                  words: input.words,
              })
    const close = () => {
        setOpenKey(null)
        setChosenId(null)
    }
    return {
        view,
        on: {
            open: (key) => {
                setOpenKey(key)
                setChosenId(null)
            },
            close,
            choose: setChosenId,
            confirm: () => {
                const operation = one === undefined || chosenId === null ? null : operationOf(one, chosenId)
                if (operation === null || !input.canWrite) return
                batch
                    .run([operation], () => t("chosen"))
                    .then((passed) => {
                        if (passed > 0) close()
                    })
                    .catch(failed)
            },
        },
    }
}
