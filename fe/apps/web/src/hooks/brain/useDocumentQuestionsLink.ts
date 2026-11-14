"use client"

import { useTranslations } from "next-intl"
import { useQueryBrainCritiqueSourcesSwr } from "@/hooks/swr"
import { useWorkspaceId } from "@/hooks/workspaces"
import { knowledgeQuestionsHref, workspaceHref } from "@/modules/routes"
import type { DocumentQuestionsLinkView } from "@/modules/types"

/**
 * The link from a document's page to its questions: "Questions of the document (N)" while the critic has open points on it, nothing
 * otherwise (and nothing for a viewer who may not read the critic's points). Reads the shared list of documents with points.
 */
export const useDocumentQuestionsLink = (sourceId: string | undefined): DocumentQuestionsLinkView | null => {
    const t = useTranslations("brainCritique")
    const workspaceId = useWorkspaceId()
    const read = useQueryBrainCritiqueSourcesSwr(sourceId !== undefined)
    const one = sourceId === undefined ? undefined : read.data?.find((source) => source.sourceId === sourceId)
    if (sourceId === undefined || one === undefined || one.open === 0) return null
    return {
        label: t("link.label", { count: one.open }),
        href: workspaceHref(workspaceId, knowledgeQuestionsHref(sourceId)),
    }
}
