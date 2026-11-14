"use client"

import { useTranslations } from "next-intl"
import { useState } from "react"
import { useQueryContactsSwr } from "@/hooks/swr"
import { detailOf } from "@/modules/contacts"
import type { ContactDetailView, ContactMergeView, ContactWords, ContactsPanesBaseProps } from "@/modules/types"

/** The merge drawer: what it shows, the commands that drive it, and the person chosen so far. */
export interface ContactMergeState {
    readonly view: ContactMergeView
    readonly on: Pick<ContactsPanesBaseProps["on"], "openMerge" | "closeMerge" | "setMergeQuery" | "chooseMerge">
    /** The person chosen to merge into the open one, with the name they go by; null until one is chosen. */
    readonly chosen: { readonly id: string; readonly name: string } | null
}

/**
 * The merge drawer of the open person: the people they may be merged into (never themselves), found by the words typed in the drawer,
 * and the one chosen. Nothing is read while the drawer is closed.
 */
export const useContactMerge = (
    detail: ContactDetailView | undefined,
    workspaceId: string,
    words: ContactWords,
): ContactMergeState => {
    const t = useTranslations("contacts")
    const [isOpen, setIsOpen] = useState(false)
    const [query, setQuery] = useState("")
    const [chosenId, setChosenId] = useState<string | null>(null)
    const read = useQueryContactsSwr(isOpen ? workspaceId : undefined, query.trim())
    const choices = (read.data?.[0]?.contacts ?? [])
        .filter((contact) => contact.id !== detail?.id)
        .map((contact) => {
            const row = detailOf(
                { contact, memory: { facts: [] }, routes: [], suggestions: [] },
                words,
                { canDelete: false, work: undefined },
            )
            return { id: contact.id, title: row.name, subtitle: row.line }
        })
    const chosen = choices.find((choice) => choice.id === chosenId)
    return {
        view: {
            isOpen,
            hint: t("mergeHint", { name: detail?.name ?? "" }),
            query,
            choices,
            chosenId,
            isLoading: isOpen && read.isLoading,
        },
        on: {
            openMerge: () => setIsOpen(true),
            closeMerge: () => {
                setIsOpen(false)
                setQuery("")
                setChosenId(null)
            },
            setMergeQuery: setQuery,
            chooseMerge: setChosenId,
        },
        chosen: chosen === undefined ? null : { id: chosen.id, name: chosen.title },
    }
}
