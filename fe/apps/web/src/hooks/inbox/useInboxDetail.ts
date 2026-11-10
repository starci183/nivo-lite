"use client"

import { useTranslations } from "next-intl"
import { useQueryInboxLeadSwr } from "@/hooks/swr"
import { useWorkspaceId } from "@/hooks/workspaces"
import { actionWordOf } from "@/modules/authority"
import { detailViewOf } from "@/modules/inbox"
import type { InboxWords } from "@/modules/inbox"
import type { InboxDetailView, InboxReadStatus } from "@/modules/types"

/** The opened customer, drawn as the head, the cards and the aside. */
interface InboxDetailRead {
    /** The customer in the reader's words; null until the read settles or while nothing is open. */
    readonly detail: InboxDetailView | null
    readonly status: InboxReadStatus
    readonly refresh: () => void
}

/** Reads the opened customer of the active workspace; nothing open reads nothing. */
export const useInboxDetail = (id: string | null, words: InboxWords): InboxDetailRead => {
    const workspaceId = useWorkspaceId()
    const g = useTranslations("governance")
    const read = useQueryInboxLeadSwr(workspaceId, id)
    const { mutate } = read
    const status: InboxReadStatus = read.data !== undefined ? "ready" : read.error === undefined ? "loading" : "failed"
    return {
        detail: read.data === undefined ? null : detailViewOf(read.data, words, (action) => actionWordOf(g, action)),
        status,
        refresh: () => void mutate(),
    }
}
