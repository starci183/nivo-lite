"use client"

import { useTranslations } from "next-intl"
import { useWorkspaceMember } from "@/hooks/knowledge"
import { useWorkspaceId } from "@/hooks/workspaces"
import { headerWithAdd } from "@/modules/brain"
import { brainTabHref, workspaceHref } from "@/modules/routes"
import type { BrainPageHeading } from "@/modules/types"
import { useBrainPageHeader, type BrainPageHeaderViewShape } from "./useBrainPageHeader"

/**
 * The header of a knowledge page drawn as tables (the documents chip, the facts chip): the four tabs, the chips with their counts, and
 * the page's command for a member who may write (add a fact on the facts chip; the documents chip keeps the header's own).
 */
export const useBrainKnowledgeHeader = (
    tab: "sources" | "facts",
    heading: BrainPageHeading,
): BrainPageHeaderViewShape => {
    const t = useTranslations("brain")
    const workspaceId = useWorkspaceId()
    const member = useWorkspaceMember()
    const header = useBrainPageHeader(tab, heading)
    if (tab !== "facts") return header
    return {
        ...header,
        props: headerWithAdd(header.props, {
            canWrite: member.canWrite,
            label: t("addFact"),
            href: workspaceHref(workspaceId, brainTabHref("facts", { fact: "new" })),
        }),
    }
}
