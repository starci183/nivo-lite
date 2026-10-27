"use client"

import { useCallback, useEffect, useState } from "react"
import { EMPTY_OFFICE_CARD_DRAFT } from "@/modules/office"
import type { OfficeCardDraft } from "@/modules/types"

const COPIED_MS = 1500

/** The product state of the thread cards: what the owner edits on each card, and the line whose text was just copied. */
export const useOfficeCardDrafts = () => {
    const [drafts, setDrafts] = useState<Readonly<Record<string, OfficeCardDraft>>>({})
    const [copiedKey, setCopiedKey] = useState<string | null>(null)

    useEffect(() => {
        if (copiedKey === null) return undefined
        const timer = window.setTimeout(() => setCopiedKey(null), COPIED_MS)
        return () => window.clearTimeout(timer)
    }, [copiedKey])

    const editCard = useCallback((key: string, patch: Partial<OfficeCardDraft>) => {
        setDrafts((current) => ({ ...current, [key]: { ...(current[key] ?? EMPTY_OFFICE_CARD_DRAFT), ...patch } }))
    }, [])

    const copy = useCallback((key: string, text: string) => {
        void navigator.clipboard
            .writeText(text)
            .then(() => setCopiedKey(key))
            .catch(() => setCopiedKey(null))
    }, [])

    return { drafts, copiedKey, editCard, copy }
}
