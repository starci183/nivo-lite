"use client"

import { useQueryInboxLeadsSwr } from "@/hooks/swr"
import { useWorkspaceId } from "@/hooks/workspaces"
import { ALL_OPTION, listViewOf } from "@/modules/inbox"
import type { InboxChoice, InboxWords } from "@/modules/inbox"
import type { InboxListView, InboxReadStatus } from "@/modules/types"

/** What the lead list read answers, drawn as the pane. */
interface InboxLeadsView {
    /** The pane: while the read waits it keeps the real words and draws no rows. */
    readonly list: InboxListView
    readonly status: InboxReadStatus
    readonly refresh: () => void
}

/** The search as the read uses it (rested and trimmed), on top of what the pane draws. */
interface InboxLeadsChoice extends InboxChoice {
    readonly search: string
}

/** The customers of the active workspace for one tab and filters, every row already in the words of the reader. */
export const useInboxLeads = (choice: InboxLeadsChoice, words: InboxWords): InboxLeadsView => {
    const workspaceId = useWorkspaceId()
    const read = useQueryInboxLeadsSwr(workspaceId, {
        tab: choice.tab,
        channel: choice.channel === ALL_OPTION ? null : choice.channel,
        agentId: choice.agent === ALL_OPTION ? null : choice.agent,
        sort: choice.sort,
        search: choice.search === "" ? null : choice.search,
        limit: 60,
    })
    const { mutate } = read
    const status: InboxReadStatus = read.data !== undefined ? "ready" : read.error === undefined ? "loading" : "failed"
    return {
        list: listViewOf(read.data, choice, words),
        status,
        refresh: () => void mutate(),
    }
}
