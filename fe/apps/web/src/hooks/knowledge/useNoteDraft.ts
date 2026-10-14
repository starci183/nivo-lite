"use client"

import { useState } from "react"
import { nextId } from "@/modules/documents"

/** One question and its answer, with the identity that keeps its row when another is removed. */
export interface FaqEntry {
    readonly id: string
    readonly q: string
    readonly a: string
}

/** The note or list of questions as the person typed it. */
interface Draft {
    readonly title: string
    readonly content: string
    readonly pairs: ReadonlyArray<FaqEntry>
    /** The person pressed add with something missing. */
    readonly tried: boolean
}

const blankPair = (): FaqEntry => ({ id: nextId(), q: "", a: "" })

const freshDraft = (): Draft => ({ title: "", content: "", pairs: [blankPair()], tried: false })

/** What the note draft gives the drawer. */
interface NoteDraft extends Draft {
    readonly setTitle: (value: string) => void
    readonly setContent: (value: string) => void
    readonly setPair: (id: string, field: "q" | "a", value: string) => void
    readonly addPair: () => void
    readonly removePair: (id: string) => void
    readonly setTried: (value: boolean) => void
    readonly reset: () => void
}

/** The written note and the list of questions with answers of the Add documents drawer. */
export const useNoteDraft = (): NoteDraft => {
    const [draft, setDraft] = useState<Draft>(freshDraft)
    return {
        ...draft,
        setTitle: (title) => setDraft((now) => ({ ...now, title })),
        setContent: (content) => setDraft((now) => ({ ...now, content })),
        setPair: (id, field, value) =>
            setDraft((now) => ({
                ...now,
                pairs: now.pairs.map((pair) => (pair.id === id ? { ...pair, [field]: value } : pair)),
            })),
        addPair: () => setDraft((now) => ({ ...now, pairs: [...now.pairs, blankPair()] })),
        removePair: (id) => setDraft((now) => ({ ...now, pairs: now.pairs.filter((pair) => pair.id !== id) })),
        setTried: (tried) => setDraft((now) => ({ ...now, tried })),
        reset: () => setDraft(freshDraft()),
    }
}
