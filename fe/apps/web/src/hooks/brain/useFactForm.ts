"use client"

import type { MutateSaveBrainFactRequest } from "@/hooks/swr"
import { dayInstant } from "@/modules/brain"
import type { FactPreset } from "@/modules/brain"
import type { BrainFact, FactScope, FactSubjectType } from "@/modules/types"
import { useState } from "react"

/** The fields of the fact form. */
interface FactFormState {
    readonly subjectType: FactSubjectType
    readonly subjectLabel: string
    readonly attributeLabel: string
    readonly value: string
    readonly scope: FactScope
    readonly modules: ReadonlyArray<string>
    readonly validFrom: string
    readonly validTo: string
    readonly note: string
}

const day = (iso: string | null): string => (iso === null ? "" : iso.slice(0, 10))

/** What the fact form gives its drawer. */
interface FactForm {
    readonly state: FactFormState
    readonly set: <K extends keyof FactFormState>(key: K, value: FactFormState[K]) => void
    /** The form is complete enough to save. */
    readonly isComplete: boolean
    /** The command payload of the form. */
    readonly payload: (gapId: string | undefined) => MutateSaveBrainFactRequest
}

/** The fields of the fact form, started afresh whenever `formKey` changes: a new fact, a new value for a fact in force, or a fact started from a suggestion or a customer question. */
export const useFactForm = (editing: BrainFact | null, preset: FactPreset | undefined, formKey: string): FactForm => {
    const initial = (): FactFormState => ({
        subjectType: editing?.subjectType ?? preset?.subjectType ?? "business",
        subjectLabel: editing?.subjectLabel ?? preset?.subjectLabel ?? "",
        attributeLabel: editing?.attributeLabel ?? preset?.attributeLabel ?? "",
        value: "",
        scope: editing?.scope ?? preset?.scope ?? "internal",
        modules: [...(editing?.modules ?? [])],
        validFrom: "",
        validTo: day(editing?.validTo ?? null),
        note: "",
    })
    const [state, setState] = useState<FactFormState>(initial)
    const [seenKey, setSeenKey] = useState(formKey)
    if (seenKey !== formKey) {
        // The form was opened for something else: start from that fact or question, not from what was typed before.
        setSeenKey(formKey)
        setState(initial())
    }
    const set = <K extends keyof FactFormState>(key: K, value: FactFormState[K]) =>
        setState((now) => ({ ...now, [key]: value }))
    return {
        state,
        set,
        isComplete: state.subjectLabel.trim() !== "" && state.attributeLabel.trim() !== "" && state.value.trim() !== "",
        payload: (gapId) => ({
            subjectType: state.subjectType,
            subjectLabel: state.subjectLabel,
            attributeLabel: state.attributeLabel,
            value: state.value,
            scope: state.scope,
            modules: [...state.modules],
            validFrom: dayInstant(state.validFrom),
            validTo: dayInstant(state.validTo),
            note: state.note,
            gapId,
        }),
    }
}
