import { useTranslations } from "next-intl"
import { useCopyLeadLink } from "./useCopyLeadLink"
import { useDraftExecution } from "./useDraftExecution"

/** What the owner groups need beside the groups: the words, the drafting and copying state and the two actions. */
export const useOwnerGroups = () => {
    const t = useTranslations("responsibilities")
    const { draft, draftingId } = useDraftExecution()
    const { copiedId, copy } = useCopyLeadLink()
    const labels = {
        groupAria: t("groupAria"),
        groupOwnedBy: (name: string) => t("groupOwnedBy", { name }),
        groupCards: (name: string) => t("groupCards", { name }),
        count: (n: number) => t(n === 1 ? "countOne" : "countMany", { n }),
        ownerHuman: t("ownerHuman"),
        ownerAgent: t("ownerAgent"),
        ownerAgentHandle: (handle: string) => t("ownerAgentHandle", { handle }),
        row: {
            owner: t("owner"),
            next: (action: string) => t("next", { action }),
            open: t("open"),
            more: t("more"),
            drafting: t("drafting"),
            aiDraft: t("aiDraft"),
            linkCopied: t("linkCopied"),
            menuOpenLead: t("menuOpenLead"),
            menuOffice: t("menuOffice"),
            menuCopy: t("menuCopy"),
            menuDraft: t("menuDraft"),
            menuDraftAgent: (name: string) => t("menuDraftAgent", { name }),
            menuDraftHuman: t("menuDraftHuman"),
        },
    }
    return {
        labels,
        draftingId,
        copiedId,
        draft: (id: string) => void draft(id),
        copy: (id: string, leadId: string) => void copy(id, leadId),
    }
}
