"use client"

import { useFormatter, useTranslations } from "next-intl"
import { slotOfSwr } from "@/hooks/slot"
import { moduleGlyphOf } from "@/hooks/installations"
import {
    useQueryMentionDirectorySwr,
    useQueryWorkChainSwr,
    useQueryWorkThreadSwr,
    useQueryWorkThreadsSwr,
} from "@/hooks/swr"
import type { ChainPanelView, ComposerOption, DataSlot, ThreadFeedView, ThreadRowView } from "@/modules/types"
import { THREAD_POLL_MS, approvalViewOf, bodySegmentsOf, chainViewOf, composerOptionsOf } from "@/modules/work-threads"
import { useThreadClock } from "./useThreadClock"

/** What the work threads board reads: the list, the open thread, its chain and who can be tagged, all worded. */
interface WorkThreadBoardData {
    /** The thread the board shows: the one picked, else the newest. */
    readonly activeId: string | null
    readonly list: DataSlot<ReadonlyArray<ThreadRowView>>
    readonly feed: DataSlot<ThreadFeedView>
    readonly chain: DataSlot<ChainPanelView>
    readonly options: ReadonlyArray<ComposerOption>
    readonly hasNextPage: boolean
    readonly isLoadingMore: boolean
    readonly hasPaginationError: boolean
    readonly loadMore: () => void
    readonly retryPage: () => void
    readonly reload: () => void
}

const STATUS_WORDS = {
    open: "statusOpen",
    waiting: "statusWaiting",
    done: "statusDone",
    stopped: "statusStopped",
} as const

const statusWordOf = (status: string): (typeof STATUS_WORDS)[keyof typeof STATUS_WORDS] =>
    status === "waiting" || status === "done" || status === "stopped" ? STATUS_WORDS[status] : STATUS_WORDS.open

/** The work threads of the workspace, the open one with its chain, read and worded for the board. */
export const useWorkThreadBoard = (selectedId: string | null): WorkThreadBoardData => {
    const t = useTranslations("workThreads")
    const format = useFormatter()
    const now = useThreadClock()
    const list = useQueryWorkThreadsSwr({ refreshInterval: THREAD_POLL_MS })
    const activeId = selectedId ?? list.data?.[0]?.id ?? null
    const request = activeId === null ? null : { threadId: activeId }
    const thread = useQueryWorkThreadSwr(request, { refreshInterval: THREAD_POLL_MS })
    const chain = useQueryWorkChainSwr(request, { refreshInterval: THREAD_POLL_MS })
    const directory = useQueryMentionDirectorySwr()
    const time = (iso: string) => format.dateTime(new Date(iso), { hour: "2-digit", minute: "2-digit" })

    const rows = list.data?.map((row): ThreadRowView => ({
        id: row.id,
        title: row.title,
        statusLabel: t(statusWordOf(row.waitingApproval ? "waiting" : row.status)),
        isSelected: row.id === activeId,
        countLabel: t("messageCount", { count: row.messageCount }),
    }))
    const feed: ThreadFeedView | undefined =
        thread.data === undefined
            ? undefined
            : {
                  title: thread.data.thread.title,
                  subtitle: t(statusWordOf(thread.data.thread.status)),
                  messages: thread.data.messages.map((message) => ({
                      id: message.id,
                      authorName: message.authorName,
                      isAgent: message.authorKind === "agent",
                      glyph: message.authorKind === "agent" ? moduleGlyphOf(message.authorRole) : null,
                      time: time(message.createdAt),
                      segments: bodySegmentsOf(message.body, message.mentions),
                      quoted: message.quoted,
                      approval: approvalViewOf(message, now, t),
                  })),
              }
    return {
        activeId,
        list: slotOfSwr({ data: rows, error: list.error, isLoading: list.isLoading }),
        feed: slotOfSwr({ data: feed, error: thread.error, isLoading: thread.isLoading }),
        chain: slotOfSwr({
            data: chain.data === undefined ? undefined : chainViewOf(chain.data, t),
            error: chain.error,
            isLoading: chain.isLoading,
        }),
        options: composerOptionsOf(directory.data, {
            member: t("sectionPeople"),
            agent: t("sectionAgents"),
            group: t("sectionGroups"),
        }),
        hasNextPage: list.hasNextPage,
        isLoadingMore: list.isLoadingMore,
        hasPaginationError: list.paginationError !== undefined,
        loadMore: list.loadMore,
        retryPage: list.retry,
        reload: () => {
            void list.mutate()
            void thread.mutate()
            void chain.mutate()
        },
    }
}
