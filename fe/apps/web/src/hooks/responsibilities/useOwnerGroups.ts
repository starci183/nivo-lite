"use client"

import { useTranslations } from "next-intl"
import { useCopyLeadLink } from "./useCopyLeadLink"
import { useDraftExecution } from "./useDraftExecution"

type UseOwnerGroupsResult = {
    labels: {
        empty: string
        groupAria: string
        groupOwnedBy: (name: string) => string
        groupCards: (name: string) => string
        count: (n: number) => string
        ownerHuman: string
        ownerAgent: string
        ownerAgentHandle: (handle: string) => string
        row: {
            owner: string
            next: (action: string) => string
            open: string
            more: string
            drafting: string
            aiDraft: string
            linkCopied: string
            menuOpenLead: string
            menuOffice: string
            menuCopy: string
            menuDraft: string
            menuDraftAgent: (name: string) => string
            menuDraftHuman: string
        }
    }
    draftingId: string | null
    copiedId: string | null
    draft: (id: string) => undefined
    copy: (id: string, leadId: string) => undefined
}

/** What the owner groups need beside the groups: the words, the drafting and copying state and the two actions. */
export const useOwnerGroups = (): UseOwnerGroupsResult => {
    const t = useTranslations("responsibilities")
    const { draft, draftingId } = useDraftExecution()
    const { copiedId, copy } = useCopyLeadLink()
    const labels = {
        empty: t("emptyAll"),
        groupAria: t("groupAria"),
        groupOwnedBy: (name: string): string => t("groupOwnedBy", { name }),
        groupCards: (name: string): string => t("groupCards", { name }),
        count: (n: number): string => t(n === 1 ? "countOne" : "countMany", { n }),
        ownerHuman: t("ownerHuman"),
        ownerAgent: t("ownerAgent"),
        ownerAgentHandle: (handle: string): string => t("ownerAgentHandle", { handle }),
        row: {
            owner: t("owner"),
            next: (action: string): string => t("next", { action }),
            open: t("open"),
            more: t("more"),
            drafting: t("drafting"),
            aiDraft: t("aiDraft"),
            linkCopied: t("linkCopied"),
            menuOpenLead: t("menuOpenLead"),
            menuOffice: t("menuOffice"),
            menuCopy: t("menuCopy"),
            menuDraft: t("menuDraft"),
            menuDraftAgent: (name: string): string => t("menuDraftAgent", { name }),
            menuDraftHuman: t("menuDraftHuman"),
        },
    }
    return {
        labels,
        draftingId,
        copiedId,
        draft: (id: string): undefined => void draft(id),
        copy: (id: string, leadId: string): undefined => void copy(id, leadId),
    }
}
