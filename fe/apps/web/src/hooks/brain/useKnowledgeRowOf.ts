"use client"

import { useFormatter, useTranslations } from "next-intl"
import {
    DOCUMENT_STATUS_KEYS,
    DOCUMENT_STATUS_TONE,
    isAgentModule,
    isDocumentActive,
    isDuplicateNote,
    isFinalFailure,
    isReadyNote,
    noteKeyOf,
    useKnowledgeProgressViewOf,
    useLibraryCommands,
    useWorkspaceMember,
} from "@/hooks/knowledge"
import { appliedBatchOf, waitingFactCountOf } from "@/modules/brain"
import type { DocumentRowBadgeView, DocumentRowView, LiveProgress } from "@/modules/documents"
import type { BrainExtraction, KnowledgeDocument, RowActionView } from "@/modules/types"
import { toast } from "@/modules/toast"
import { useBrainBoard } from "./useBrainBoard"

type Translate = ReturnType<typeof useTranslations<"knowledge">>

interface SourceStatusInput {
    readonly source: KnowledgeDocument
    readonly reading: BrainExtraction["status"] | undefined
    readonly learnedFacts: number | null
}
type SourceBadgesInput = Pick<SourceStatusInput, "source" | "reading"> & { readonly status: string }

/**
 * Where a document stands in one word: still being read, learnt (with how many facts it gave, when the viewer may see them),
 * failed, or what else holds it back.
 */
const statusLabelOf = (t: Translate, input: SourceStatusInput): string => {
    const { source, reading, learnedFacts } = input
    if (isDocumentActive(source.status)) return t("libReading")
    if (source.status === "failed") return t("libFailed")
    if (source.status !== "ready") return t(DOCUMENT_STATUS_KEYS[source.status])
    if (reading !== "done") return t("libFactsNone")
    return learnedFacts === null ? t("libLearnedPlain") : t("libLearned", { count: learnedFacts })
}

/** The agent a document is kept for, or every agent. */
const moduleLabelOf = (t: Translate, source: KnowledgeDocument): string =>
    source.module !== null && isAgentModule(source.module) ? t(`module_${source.module}`) : t("moduleAll")

/** The badges of a row: where the document stands (a ready one whose facts were not read is neutral), who may read it and for which agent. */
const badgesOf = (t: Translate, input: SourceBadgesInput): ReadonlyArray<DocumentRowBadgeView> => {
    const { source, status, reading } = input
    return [
        {
            label: status,
            tone: source.status === "ready" && reading !== "done" ? "neutral" : DOCUMENT_STATUS_TONE[source.status],
        },
        {
            label: t(source.visibility === "public" ? "vis_public" : "vis_internal"),
            tone: source.visibility === "public" ? "accent" : "neutral",
        },
        { label: moduleLabelOf(t, source), tone: "neutral" },
    ]
}

/** What a row may offer to run again. */
interface RetryChoice {
    readonly canRetry: boolean
    readonly canRetryFacts: boolean
    /** How many facts of an internal document wait for a person and may be applied together; 0 offers nothing. */
    readonly bulkCount: number
    /** The batch of facts of the document applied together and still in force, or null. */
    readonly batch: string | null
}

/** The action that takes the facts applied together from a document back to review, when there are some. */
const bulkUndoOf = (t: Translate, batch: string | null, pending: string | undefined): ReadonlyArray<RowActionView> =>
    batch === null ? [] : [{ id: "undo-facts", label: t("bulkUndo"), isPending: pending === "undo-facts" }]

/** The neutral "try again" of a row: the document itself, or only the reading of its facts. */
const retryActionsOf = (t: Translate, choice: RetryChoice, pending: string | undefined): ReadonlyArray<RowActionView> =>
    [
        ...(choice.canRetry ? [{ id: "retry", label: t("retry"), isPending: pending === "retry" }] : []),
        ...(choice.canRetryFacts
            ? [{ id: "retry-facts", label: t("retry"), isPending: pending === "retry-facts" }]
            : []),
        ...(choice.bulkCount > 0
            ? [
                  {
                      id: "apply-facts",
                      label: t("bulkApply", { count: choice.bulkCount }),
                      isPending: pending === "apply-facts",
                  },
              ]
            : []),
        ...bulkUndoOf(t, choice.batch, pending),
    ].map((action) => ({
        ...action,
        isDisabled: pending !== undefined && pending !== action.id,
        disabledReason: t("actionBusy"),
    }))

/**
 * The row of a document as every list of documents draws it: the kind, topic and date, where it stands, the plain reason it failed,
 * who may read it, the live stage with its count and bar while a worker is on it, and the retry when it may be run again.
 * `live` is what `useKnowledgeSources` gives; the facts reading comes from the Second Brain.
 */
export const useKnowledgeRowOf = (live: Readonly<Record<string, LiveProgress>>) => {
    const t = useTranslations("knowledge")
    const feedback = useTranslations("toast")
    const format = useFormatter()
    const commands = useLibraryCommands()
    const member = useWorkspaceMember()
    const progressOf = useKnowledgeProgressViewOf(live)
    const board = useBrainBoard()
    const failed = () => {
        toast.danger(feedback("errorTitle"), { description: feedback("defaultError") })
    }
    const factsOf = (source: KnowledgeDocument): number =>
        board.facts.filter((fact) =>
            fact.evidence.some((proof) => proof.kind === "document" && proof.ref === source.id),
        ).length
    const rowOf = (source: KnowledgeDocument): DocumentRowView => {
        const parts = [
            t(`kind_${source.kind}`),
            ...(source.topic === null ? [] : [source.topic]),
            format.dateTime(new Date(source.createdAt), { dateStyle: "medium" }),
            ...(source.partCount > 1 ? [t("docParts", { count: source.partCount })] : []),
        ]
        const reading = board.extractions.find((one) => one.sourceId === source.id)?.status
        const status = statusLabelOf(t, { source, reading, learnedFacts: member.canWrite ? factsOf(source) : null })
        const failedNote = source.status === "failed" ? source.error : null
        const canRetry =
            member.canWrite && failedNote !== null && !isReadyNote(failedNote) && !isFinalFailure(failedNote)
        const duplicate = source.error !== null && isDuplicateNote(source.error)
        const canRetryFacts = member.canWrite && source.status === "ready" && reading !== "done" && !duplicate
        const bulkable = member.canWrite && source.status === "ready" && source.visibility === "internal"
        return {
            id: source.id,
            title: source.title,
            lines: [parts.join(" · "), ...(source.error === null ? [] : [t(noteKeyOf(source.error))])],
            badges: badgesOf(t, { source, status, reading }),
            progress: progressOf(source.id) ?? undefined,
            actions: retryActionsOf(
                t,
                {
                    canRetry,
                    canRetryFacts,
                    bulkCount: bulkable ? waitingFactCountOf(board.facts, source.id) : 0,
                    batch: bulkable ? appliedBatchOf(board.facts, source.id) : null,
                },
                commands.pending[source.id],
            ),
        }
    }
    const dispatch = (sourceId: string, actionId: string) => {
        if (!member.canWrite) return
        if (actionId === "retry") {
            commands.retry(sourceId).catch(failed)
            return
        }
        if (actionId === "retry-facts") {
            commands.reread(sourceId).catch(failed)
            return
        }
        if (actionId === "apply-facts") {
            commands.applyFacts(sourceId).catch(failed)
            return
        }
        const batch = appliedBatchOf(board.facts, sourceId)
        if (actionId === "undo-facts" && batch !== null) commands.undoFacts(batch, sourceId).catch(failed)
    }
    return { rowOf, commands, member, board, dispatch }
}
