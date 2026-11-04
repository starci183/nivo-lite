"use client"

import { useState } from "react"
import { nextId } from "@/modules/documents"
import type { FaqEntry, NoteDraft, NoteDraftFields } from "@/hooks/knowledgeAddTypes"

const blankPair = (): FaqEntry => ({ id: nextId(), q: "", a: "" })

const freshDraft = (): NoteDraftFields => ({ title: "", content: "", pairs: [blankPair()], tried: false })

/** The written note and the list of questions with answers of the Add documents drawer. */
export const useNoteDraft = (): NoteDraft => {
    const [draft, setDraft] = useState<NoteDraftFields>(freshDraft)
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
