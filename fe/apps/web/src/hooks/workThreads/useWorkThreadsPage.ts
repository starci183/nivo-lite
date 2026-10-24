"use client"

import { useTranslations } from "next-intl"
import { useState } from "react"
import { useSlotLabels } from "@/hooks/slot"
import { useActiveWorkspace } from "@/hooks/workspaces"
import { CONSOLE_ROUTES } from "@/modules/routes"
import type { WorkThreadBoardHandlers, WorkThreadBoardView } from "@/modules/types"
import { useThreadActions } from "./useThreadActions"
import { useThreadComposer } from "./useThreadComposer"
import { useThreadForm } from "./useThreadForm"
import { useWorkThreadBoard } from "./useWorkThreadBoard"

/** State and resolved words needed by the thread list rail. */
interface RailContext {
    readonly t: ReturnType<typeof useTranslations<"workThreads">>
    readonly slotLabels: ReturnType<typeof useSlotLabels>
    readonly board: ReturnType<typeof useWorkThreadBoard>
    readonly form: ReturnType<typeof useThreadForm>
    readonly actions: ReturnType<typeof useThreadActions>
}

/** Resolves the thread list, its opening form and next-page control. */
const railOf = ({ t, slotLabels, board, form, actions }: RailContext): WorkThreadBoardView["rail"] => ({
    title: t("listTitle"),
    listLabel: t("listLabel"),
    newLabel: t("newThread"),
    form: {
        label: t("newThreadLabel"),
        placeholder: t("newThreadPlaceholder"),
        createLabel: t("createThread"),
        cancelLabel: t("cancel"),
    },
    slot: board.list,
    slotLabels: slotLabels(t("listEmpty")),
    isFormOpen: form.isOpen,
    titleDraft: form.title,
    isCreating: actions.isOpening,
    hasNextPage: board.hasNextPage,
    isLoadingMore: board.isLoadingMore,
    paginationFailure: board.hasPaginationError ? t("loadMoreFailed") : null,
    loadMoreLabel: t("loadMore"),
    retryPageLabel: t("retryPage"),
})

/** The work threads page: what it draws and what it asks, the threads read in the browser, the draft and the form held here. */
export const useWorkThreadsPage = (): {
    readonly props: WorkThreadBoardView
    readonly on: WorkThreadBoardHandlers
} => {
    const t = useTranslations("workThreads")
    const slotLabels = useSlotLabels()
    const { activeWorkspaceId } = useActiveWorkspace()
    const [selection, setSelection] = useState<{
        readonly workspaceId: string | undefined
        readonly id: string
    } | null>(null)
    const selectedId = selection !== null && selection.workspaceId === activeWorkspaceId ? selection.id : null
    const selectThread = (id: string) => setSelection({ workspaceId: activeWorkspaceId, id })
    const board = useWorkThreadBoard(selectedId)
    const actions = useThreadActions({ threadId: board.activeId, reload: board.reload, opened: selectThread })
    const composer = useThreadComposer(actions.send)
    const form = useThreadForm(actions.open)
    return {
        props: {
            crumbLabel: t("crumbLabel"),
            crumbs: [
                { id: "home", label: t("crumbHome"), href: CONSOLE_ROUTES.dashboard },
                { id: "threads", label: t("pageTitle") },
            ],
            title: t("pageTitle"),
            subtitle: t("subtitle"),
            rail: railOf({ t, slotLabels, board, form, actions }),
            thread: {
                hasThread: board.activeId !== null,
                noSelection: t("noSelection"),
                slot: board.feed,
                slotLabels: slotLabels(t("feedEmpty")),
                feedLabel: t("feedLabel"),
                feedEmpty: t("feedEmpty"),
                aiLabel: t("aiBadge"),
                quotedLabel: t("quotedLabel"),
                approvalLabels: { cardLabel: t("approvalCardLabel"), approve: t("approve"), reject: t("reject") },
                decidingId: actions.decidingId,
                composerLabel: t("composerLabel"),
                composerPlaceholder: t("composerPlaceholder"),
                composerHint: t("composerHint"),
                mentionLabel: t("mentionLabel"),
                sendLabel: t("send"),
                draft: composer.draft,
                options: board.options,
                isSending: actions.isSending,
            },
            chain: {
                title: t("chainTitle"),
                slot: board.chain,
                slotLabels: slotLabels(t("chainEmpty")),
                labels: {
                    stepsLabel: t("chainLabel"),
                    emptyMessage: t("chainEmpty"),
                    completeTitle: t("chainCompleteTitle"),
                    completeHint: t("chainCompleteHint"),
                },
            },
        },
        on: {
            pick: selectThread,
            openForm: form.show,
            cancelForm: form.cancel,
            title: form.setTitle,
            create: form.create,
            draft: composer.setDraft,
            pickMention: composer.pickMention,
            send: composer.submit,
            approve: (messageId) => void actions.decideCard(messageId, "approve"),
            reject: (messageId) => void actions.decideCard(messageId, "reject"),
            retry: board.reload,
            loadMore: board.loadMore,
            retryPage: board.retryPage,
        },
    }
}
