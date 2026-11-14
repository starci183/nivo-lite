"use client"

import { useFormatter, useTranslations } from "next-intl"
import { useQueryKnowledgeUsageSwr } from "@/hooks/swr"
import { slotOfSwr } from "@/hooks/slot"
import { isFinalFailure, isReadyNote, type KnowledgeSourcesView } from "@/hooks/knowledge"
import { useWorkspaceId } from "@/hooks/workspaces"
import { readError } from "@/hooks/workspaceread"
import { docTruthRowOf, usageLimitsOf } from "@/modules/documents"
import { navigation } from "@/modules/i18n"
import { creditsPath, knowledgeQuestionsHref, knowledgeSourceHref, workspaceHref } from "@/modules/routes"
import type { DataSlot, DocTruthRowView, KnowledgeDocument, UsageLimitsView } from "@/modules/types"
import type { KnowledgeRowOfView } from "./useKnowledgeRowOf"

/** What the documents list gives its block about the truths of each document and the allowance of the workspace. */
export interface DocumentTruthsView {
    /** The meters of the usage block as the usage read settled. */
    readonly usage: DataSlot<UsageLimitsView>
    /** The same meters with no figures: the usage block's loading state keeps its real labels. */
    readonly usagePlaceholder: UsageLimitsView
    /** One row per document, in the order the list reads them. */
    readonly rows: ReadonlyArray<DocTruthRowView>
    readonly on: {
        /** "Xem": the document's page. */
        readonly view: (id: string) => void
        /** The one neutral command of a row: answer its questions, try again, or top up credits. */
        readonly control: (id: string, kind: "answer" | "retry" | "topup") => void
    }
}

/** Whether a failed document may be run again: it failed for a reason a second try can clear. */
const canRetryOf = (source: KnowledgeDocument): boolean =>
    source.status === "failed" && source.error !== null && !isReadyNote(source.error) && !isFinalFailure(source.error)

/**
 * The truths of the documents (INGEST-2): where the reading of each stands and what it gave, with the allowance of the workspace.
 * "Try again" is the door the list already had (a failed document runs again, a document whose truths were not read is read again).
 */
export const useDocumentTruths = (sources: KnowledgeSourcesView, rowOf: KnowledgeRowOfView): DocumentTruthsView => {
    const t = useTranslations("brainTruths")
    const formatter = useFormatter()
    const router = navigation.useRouter()
    const workspaceId = useWorkspaceId()
    const usageRead = useQueryKnowledgeUsageSwr()
    const usage = slotOfSwr<UsageLimitsView>({
        data: usageRead.data === undefined ? undefined : usageLimitsOf(t, formatter, usageRead.data),
        error: readError(usageRead),
        isLoading: usageRead.isLoading,
    })
    const rows = (sources.sources ?? []).map((source) =>
        docTruthRowOf(t, {
            source,
            truths: sources.truths[source.id] ?? null,
            canWrite: rowOf.member.canWrite,
            canRetryDocument: canRetryOf(source),
            isRetrying: rowOf.commands.pending[source.id] !== undefined,
        }),
    )
    return {
        usage,
        usagePlaceholder: usageLimitsOf(t, formatter, {
            documents: { usedBytes: 0, limitBytes: 1, count: 0 },
            truths: { count: 0, limitCount: 1, usedBytes: 0, limitBytes: 1 },
        }),
        rows,
        on: {
            view: (id) => router.push(workspaceHref(workspaceId, knowledgeSourceHref(id))),
            control: (id, kind) => {
                if (kind === "answer") router.push(workspaceHref(workspaceId, knowledgeQuestionsHref(id)))
                else if (kind === "topup") router.push(workspaceHref(workspaceId, creditsPath()))
                else
                    rowOf.dispatch(
                        id,
                        sources.sources?.find((source) => source.id === id)?.status === "failed"
                            ? "retry"
                            : "retry-facts",
                    )
            },
        },
    }
}
