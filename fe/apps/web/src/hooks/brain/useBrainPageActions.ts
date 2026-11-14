import { useTranslations } from "next-intl"
import { useWorkspaceMember } from "@/hooks/knowledge"
import { useQueryKnowledgeUsageSwr } from "@/hooks/swr"
import { useWorkspaceId } from "@/hooks/workspaces"
import { brainPartOf, firstTabOf } from "@/modules/brain"
import { limitLevelOf } from "@/modules/documents"
import { navigation } from "@/modules/i18n"
import { BRAIN_PARTS, brainTabHref, workspaceHref, type BrainTab } from "@/modules/routes"
import type { BrainPageHeaderView } from "@/modules/types"

/** The view `useBrainPageActions` returns. */
export interface BrainPageActionsView {
    props: BrainPageHeaderView["actions"]
    on: {
        setPart: (id: string) => void
    }
}

/** The part switch and the way to add documents. */
export const useBrainPageActions = (tab: BrainTab): BrainPageActionsView => {
    const t = useTranslations("secondBrain")
    const router = navigation.useRouter()
    const workspaceId = useWorkspaceId()
    const member = useWorkspaceMember()
    const usage = useQueryKnowledgeUsageSwr().data?.documents
    const isFull = usage !== undefined && limitLevelOf(usage.usedBytes, usage.limitBytes) === "full"
    const part = brainPartOf(tab)
    const props: BrainPageHeaderView["actions"] = {
        part: {
            label: t("partsLabel"),
            options: BRAIN_PARTS.map((one) => ({ id: one, label: t(`part_${one}`) })),
            value: part,
        },
        add:
            member.canWrite && part === "internal" && tab !== "sources"
                ? {
                      label: t("addDocuments"),
                      href: workspaceHref(workspaceId, brainTabHref("sources")),
                      isDisabled: isFull,
                  }
                : null,
    }
    return {
        props,
        on: {
            setPart: (id: string) => {
                const next = BRAIN_PARTS.find((one) => one === id)
                if (next !== undefined) router.push(workspaceHref(workspaceId, brainTabHref(firstTabOf(next))))
            },
        },
    }
}
