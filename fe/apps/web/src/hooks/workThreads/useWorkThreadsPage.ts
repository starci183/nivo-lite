"use client"

import { useTranslations } from "next-intl"
import { useState } from "react"
import { useSlotLabels } from "@/hooks/slot"
import { CONSOLE_ROUTES } from "@/modules/routes"
import type { WorkThreadBoardHandlers, WorkThreadBoardView } from "@/modules/types"
import { useThreadActions } from "./useThreadActions"
import { useThreadComposer } from "./useThreadComposer"
import { useThreadForm } from "./useThreadForm"
import { useWorkThreadBoard } from "./useWorkThreadBoard"

/** The work threads page: what it draws and what it asks, the threads read in the browser, the draft and the form held here. */
export const useWorkThreadsPage = (): {
    readonly props: WorkThreadBoardView
    readonly on: WorkThreadBoardHandlers
} => {
    const t = useTranslations("workThreads")
    const slotLabels = useSlotLabels()
    const [selectedId, setSelectedId] = useState<string | null>(null)
    const board = useWorkThreadBoard(selectedId)
    const actions = useThreadActions({ threadId: board.activeId, reload: board.reload, opened: setSelectedId })
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
            rail: {
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
            },
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
            pick: setSelectedId,
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
        },
    }
}
