"use client"

import { useEffect, useState } from "react"
import { useQueryContactModuleBlocksSwr, useQueryContactSwr, useQueryContactsSwr } from "@/hooks/swr"
import { slotOfSwr } from "@/hooks/slot"
import { contactRowOf, type ContactDetailWire, type ContactModulesWire } from "@/modules/contacts"
import type { ContactListRowView, ContactWords, ContactsListData, DataSlot } from "@/modules/types"

/** How long the search waits for the person to stop typing before it asks the back end (milliseconds). */
const SEARCH_DEBOUNCE_MS = 250

/** The search words after the person stopped typing: the list is read for these, not for every keystroke. */
const useDebounced = (value: string): string => {
    const [settled, setSettled] = useState(value)
    useEffect(() => {
        const timer = setTimeout(() => setSettled(value), SEARCH_DEBOUNCE_MS)
        return () => clearTimeout(timer)
    }, [value])
    return settled
}

/** What the contacts page reads: the list of people (a page at a time) and the person that is open. */
export interface ContactsData {
    readonly query: string
    readonly setQuery: (value: string) => void
    /** The list as one slot: loading, failed, empty, or the rows with whether more follow. */
    readonly list: DataSlot<ContactsListData>
    readonly loadMore: () => void
    readonly retryList: () => void
    readonly detailSlot: DataSlot<ContactDetailWire> | null
    readonly retryDetail: () => void
    /** What each installed agent's module knows about the open person; null on the list itself. */
    readonly modulesSlot: DataSlot<ContactModulesWire> | null
    readonly retryModules: () => void
}

/** The rows of every page read so far, and whether the last page says more follow. */
const listOf = (
    pages: ReadonlyArray<{
        readonly next: string | null
        readonly contacts: ReadonlyArray<Parameters<typeof contactRowOf>[0]>
    }>,
    words: ContactWords,
): ContactsListData => {
    const rows: Array<ContactListRowView> = []
    for (const page of pages) for (const contact of page.contacts) rows.push(contactRowOf(contact, words))
    return { rows, hasMore: (pages.at(-1)?.next ?? null) !== null }
}

/**
 * Reads the people of the workspace by the search the person typed and the one that is open. Nothing is read for a viewer who may not
 * see contacts (`enabled` false): the page tells them so instead.
 */
export const useContactsData = (
    workspaceId: string,
    contactId: string | null | undefined,
    enabled: boolean,
    words: ContactWords,
): ContactsData => {
    const [query, setQuery] = useState("")
    const search = useDebounced(query.trim())
    const pages = useQueryContactsSwr(enabled ? workspaceId : undefined, search)
    const person = useQueryContactSwr(enabled && typeof contactId === "string" ? contactId : undefined)
    const modules = useQueryContactModuleBlocksSwr(enabled && typeof contactId === "string" ? contactId : undefined)
    const settled = pages.data === undefined ? undefined : listOf(pages.data, words)
    const list = listSlotOf(settled, search, pages)
    return {
        query,
        setQuery,
        list,
        loadMore: () => void pages.setSize((size) => size + 1),
        retryList: () => void pages.mutate(),
        detailSlot: contactId === null ? null : detailSlotFor(contactId, person),
        retryDetail: () => void person.mutate(),
        modulesSlot: contactId === null ? null : modulesSlotFor(contactId, modules),
        retryModules: () => void modules.mutate(),
    }
}

/** The open person as a slot: a person who is gone (the read answered null) is an empty slot, not an error. */
const openPersonSlotOf = (person: ReturnType<typeof useQueryContactSwr>): DataSlot<ContactDetailWire> => {
    if (person.data === null) return { isEmpty: true }
    return slotOfSwr({
        data: person.data,
        error: person.error,
        isLoading: person.isLoading,
        isValidating: person.isValidating,
    })
}

/** The list as a slot: nobody at all (no search typed) is an empty slot with its own words; a search nobody matches is an empty list card. */
const listSlotOf = (
    settled: ContactsListData | undefined,
    search: string,
    read: ReturnType<typeof useQueryContactsSwr>,
): DataSlot<ContactsListData> => {
    if (settled === undefined) {
        return slotOfSwr<ContactsListData>({
            data: undefined,
            error: read.error,
            isLoading: read.isLoading,
            isValidating: read.isValidating,
        })
    }
    if (settled.rows.length === 0 && search === "") return { isEmpty: true, isValidating: read.isValidating }
    return { items: settled, isValidating: read.isValidating }
}

/** The open person as a slot: none for the list itself, loading on the loading page of a person (the id is not known yet), else the read. */
const detailSlotFor = (
    contactId: string | undefined,
    person: ReturnType<typeof useQueryContactSwr>,
): DataSlot<ContactDetailWire> => (contactId === undefined ? { isLoading: true } : openPersonSlotOf(person))

/** The module blocks of the open person as a slot: nothing mounted at all (no installed module declares a block) is an empty slot. */
const modulesSlotFor = (
    contactId: string | undefined,
    modules: ReturnType<typeof useQueryContactModuleBlocksSwr>,
): DataSlot<ContactModulesWire> => {
    if (contactId === undefined) return { isLoading: true }
    if (modules.data?.length === 0) return { isEmpty: true, isValidating: modules.isValidating }
    return slotOfSwr({
        data: modules.data,
        error: modules.error,
        isLoading: modules.isLoading,
        isValidating: modules.isValidating,
    })
}
