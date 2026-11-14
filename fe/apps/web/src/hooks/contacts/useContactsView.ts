"use client"

import { useTranslations } from "next-intl"
import { useState } from "react"
import { useMember } from "@/hooks/member"
import { mapSlot, useSlotLabels } from "@/hooks/slot"
import { useQueryContactWorkSwr } from "@/hooks/swr"
import { useWorkspaceId } from "@/hooks/workspaces"
import { moduleAgentsOf } from "@/modules/contacts"
import { navigation } from "@/modules/i18n"
import { APP_ROUTES, CONSOLE_ROUTES, contactHref, workspaceHref } from "@/modules/routes"
import { detailSlotOf } from "./contacts.shared"
import { useContactCommands } from "./useContactCommands"
import { useContactConfirm } from "./useContactConfirm"
import { useContactDrawers } from "./useContactDrawers"
import { useContactHistory } from "./useContactHistory"
import { useContactMerge } from "./useContactMerge"
import { useContactNames } from "./useContactNames"
import { useContactWords } from "./useContactWords"
import { useContactsCopy } from "./useContactsCopy"
import { useContactsData } from "./useContactsData"
import type { ContactDetailView, ContactsPanesBaseProps, SlotLabels } from "@/modules/types"

/** The words of one slot's statuses: the resolved recipe with the notice of an empty read and the title of a failed one named for the region. */
const labelsOf = (slotLabels: ReturnType<typeof useSlotLabels>, empty: string, error: string): SlotLabels => ({
    ...slotLabels(empty),
    error,
})

/** The questions the page asks before an irreversible change: merging the chosen person, cutting an identity, deleting, merging a suggestion. */
const asksOf = (
    confirm: ReturnType<typeof useContactConfirm>,
    merge: ReturnType<typeof useContactMerge>,
    detail: ContactDetailView | undefined,
): Pick<ContactsPanesBaseProps["on"], "submitMerge" | "askUnlink" | "askDelete" | "askMergeSuggestion"> => ({
    submitMerge: () => {
        if (merge.chosen === null) return
        confirm.ask({ kind: "merge", fromId: merge.chosen.id, from: merge.chosen.name })
        merge.on.closeMerge()
    },
    askUnlink: (identityId) =>
        confirm.ask({
            kind: "unlink",
            identityId,
            title: detail?.identities.find((one) => one.id === identityId)?.title ?? "",
        }),
    askDelete: () => confirm.ask({ kind: "delete" }),
    askMergeSuggestion: (suggestedId) =>
        confirm.ask({
            kind: "merge",
            fromId: suggestedId,
            from: detail?.suggestions.find((one) => one.contactId === suggestedId)?.name ?? "",
        }),
})

/**
 * The whole view of the contacts page: reads the people and the one open, words them, and builds the commands. The search, the
 * drawers, the question before an irreversible change and the suggestions the person dismissed live in the hooks it composes, so
 * the block only hands the result to its pure half. `contactId` is the person the address names (null on the list itself,
 * undefined on the loading page of a person).
 */
export const useContactsView = (contactId: string | null | undefined): ContactsPanesBaseProps => {
    const t = useTranslations("contacts")
    const router = navigation.useRouter()
    const workspaceId = useWorkspaceId()
    const member = useMember()
    const slotLabels = useSlotLabels()
    const commands = useContactCommands()
    const isManager = member !== null && member.role !== "staff"
    const names = useContactNames()
    const words = useContactWords(names)
    const work = useQueryContactWorkSwr(isManager && typeof contactId === "string" ? contactId : undefined)
    const data = useContactsData(workspaceId, contactId, isManager, words)
    const [dismissed, setDismissed] = useState<ReadonlySet<string>>(new Set())
    const open = (id: string): void => router.push(workspaceHref(workspaceId, contactHref(id)))
    const openList = (): void => router.push(workspaceHref(workspaceId, CONSOLE_ROUTES.contacts))
    const detailSlot = detailSlotOf(data.detailSlot, words, {
        canDelete: member?.role === "owner",
        work: work.data,
        dismissed,
    })
    const detail = detailSlot !== null && "items" in detailSlot ? detailSlot.items : undefined
    const history = useContactHistory({
        workspaceId,
        contactId,
        enabled: isManager,
        detail: data.detailSlot !== null && "items" in data.detailSlot ? data.detailSlot.items : undefined,
    })
    const drawers = useContactDrawers({ detail, commands, open })
    const merge = useContactMerge(detail, workspaceId, words)
    const confirm = useContactConfirm({ detail, commands, open, openList })
    return {
        props: {
            copy: useContactsCopy(),
            access: isManager ? "manager" : "staff",
            list: data.list,
            listLabels: labelsOf(slotLabels, t("emptyTitle"), t("loadFailTitle")),
            detail: detailSlot,
            detailLabels: labelsOf(slotLabels, t("goneTitle"), t("loadFailTitle")),
            modules: data.modulesSlot === null ? null : mapSlot(data.modulesSlot, moduleAgentsOf),
            modulesLabels: labelsOf(slotLabels, t("modulesTitle"), t("loadFailTitle")),
            history: history.view,
            historyLabels: labelsOf(slotLabels, t("historyEmpty"), t("historyErrorTitle")),
            selectedId: contactId ?? null,
            query: data.query,
            edit: drawers.edit,
            link: drawers.link,
            merge: merge.view,
            confirm: confirm.confirm,
            isPending: commands.isPending,
        },
        on: {
            ...drawers.on,
            ...merge.on,
            ...confirm.on,
            setQuery: data.setQuery,
            retryList: data.retryList,
            retryDetail: data.retryDetail,
            retryModules: data.retryModules,
            selectHistoryTab: history.selectTab,
            historyOlder: history.older,
            retryHistory: history.retry,
            select: open,
            loadMore: data.loadMore,
            goHome: () => router.push(workspaceHref(workspaceId, APP_ROUTES.workspaceHome)),
            goList: openList,
            ...asksOf(confirm, merge, detail),
            dismissSuggestion: (suggestedId) => setDismissed((current) => new Set([...current, suggestedId])),
            forget: (name) => void commands.forget(detail?.id ?? "", name),
        },
    }
}
