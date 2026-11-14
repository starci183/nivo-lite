"use client"

import { useTranslations } from "next-intl"
import { useState } from "react"
import { useMember } from "@/hooks/member"
import { mapSlot, useSlotLabels } from "@/hooks/slot"
import { useWorkspaceId } from "@/hooks/workspaces"
import { moduleAgentsOf } from "@/modules/contacts"
import { navigation } from "@/modules/i18n"
import { APP_ROUTES, CONSOLE_ROUTES, contactHref, workspaceHref } from "@/modules/routes"
import { detailSlotOf } from "./contacts.shared"
import { useContactCommands } from "./useContactCommands"
import { useContactConfirm } from "./useContactConfirm"
import { useContactDrawers } from "./useContactDrawers"
import { useContactMerge } from "./useContactMerge"
import { useContactWords } from "./useContactWords"
import { useContactsCopy } from "./useContactsCopy"
import { useContactsData } from "./useContactsData"
import type { ContactsPanesBaseProps } from "@/modules/types"

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
    const words = useContactWords()
    const commands = useContactCommands()
    const isManager = member !== null && member.role !== "staff"
    const data = useContactsData(workspaceId, contactId, isManager, words)
    const [dismissed, setDismissed] = useState<ReadonlySet<string>>(new Set())
    const open = (id: string): void => router.push(workspaceHref(workspaceId, contactHref(id)))
    const openList = (): void => router.push(workspaceHref(workspaceId, CONSOLE_ROUTES.contacts))
    const detailSlot = detailSlotOf(data.detailSlot, words, {
        canDelete: member?.role === "owner",
        dismissed,
    })
    const detail = detailSlot !== null && "items" in detailSlot ? detailSlot.items : undefined
    const drawers = useContactDrawers({ detail, commands, open })
    const merge = useContactMerge(detail, workspaceId, words)
    const confirm = useContactConfirm({ detail, commands, open, openList })
    return {
        props: {
            copy: useContactsCopy(),
            access: isManager ? "manager" : "staff",
            list: data.list,
            listLabels: { ...slotLabels(t("emptyTitle")), error: t("loadFailTitle") },
            detail: detailSlot,
            detailLabels: { ...slotLabels(t("goneTitle")), error: t("loadFailTitle") },
            modules: data.modulesSlot === null ? null : mapSlot(data.modulesSlot, moduleAgentsOf),
            modulesLabels: { ...slotLabels(t("modulesEmptyTitle")), error: t("loadFailTitle") },
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
            select: open,
            loadMore: data.loadMore,
            goHome: () => router.push(workspaceHref(workspaceId, APP_ROUTES.workspaceHome)),
            goList: openList,
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
            dismissSuggestion: (suggestedId) => setDismissed((current) => new Set([...current, suggestedId])),
            forget: (name) => void commands.forget(detail?.id ?? "", name),
        },
    }
}
