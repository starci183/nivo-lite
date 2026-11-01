"use client"

import { useFormatter, useTranslations } from "next-intl"
import {
    DOCUMENT_STATUS_KEYS,
    DOCUMENT_STATUS_TONE,
    isAgentModule,
    isDocumentActive,
    isReadyNote,
    noteKeyOf,
    useKnowledgeProgressViewOf,
    useLibraryCommands,
    useWorkspaceMember,
} from "@/hooks/knowledge"
import type { DocumentRowActionView, DocumentRowBadgeView, DocumentRowView, LiveProgress } from "@/modules/documents"
import type { BrainExtraction, KnowledgeDocument } from "@/modules/types"
import { useBrainBoard } from "./useBrainBoard"

type Translate = ReturnType<typeof useTranslations<"knowledge">>

/**
 * Where a document stands in one word: still being read, learnt (with how many facts it gave, when the viewer may see them),
 * failed, or what else holds it back.
 */
const statusLabelOf = (
    t: Translate,
    source: KnowledgeDocument,
    reading: BrainExtraction["status"] | undefined,
    learnedFacts: number | null,
): string => {
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
const badgesOf = (
    t: Translate,
    source: KnowledgeDocument,
    status: string,
    reading: BrainExtraction["status"] | undefined,
): ReadonlyArray<DocumentRowBadgeView> => [
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

/** What a row may offer to run again. */
interface RetryChoice {
    readonly canRetry: boolean
    readonly canRetryFacts: boolean
}

/** The neutral "try again" of a row: the document itself, or only the reading of its facts. */
const retryActionsOf = (
    t: Translate,
    commands: ReturnType<typeof useLibraryCommands>,
    sourceId: string,
    choice: RetryChoice,
): ReadonlyArray<DocumentRowActionView> => [
    ...(choice.canRetry ? [{ id: "retry", label: t("retry"), onPress: () => commands.retry(sourceId) }] : []),
    ...(choice.canRetryFacts
        ? [{ id: "retry-facts", label: t("retry"), onPress: () => commands.reread(sourceId) }]
        : []),
]

/**
 * The row of a document as every list of documents draws it: the kind, topic and date, where it stands, the plain reason it failed,
 * who may read it, the live stage with its count and bar while a worker is on it, and the retry when it may be run again.
 * `live` is what `useKnowledgeSources` gives; the facts reading comes from the Second Brain.
 */
export const useKnowledgeRowOf = (live: Readonly<Record<string, LiveProgress>>) => {
    const t = useTranslations("knowledge")
    const format = useFormatter()
    const commands = useLibraryCommands()
    const member = useWorkspaceMember()
    const progressOf = useKnowledgeProgressViewOf(live)
    const board = useBrainBoard()
    const factsOf = (source: KnowledgeDocument): number =>
        board.facts.filter((fact) =>
            fact.evidence.some((proof) => proof.kind === "document" && proof.ref === source.id),
        ).length
    const rowOf = (source: KnowledgeDocument): DocumentRowView => {
        const parts = [
            t(`kind_${source.kind}`),
            ...(source.topic === null ? [] : [source.topic]),
            format.dateTime(new Date(source.createdAt), { dateStyle: "medium" }),
        ]
        const reading = board.extractions.find((one) => one.sourceId === source.id)?.status
        const status = statusLabelOf(t, source, reading, member.canWrite ? factsOf(source) : null)
        const canRetry =
            member.canWrite && source.status === "failed" && source.error !== null && !isReadyNote(source.error)
        const canRetryFacts = member.canWrite && source.status === "ready" && reading !== "done"
        return {
            id: source.id,
            title: source.title,
            lines: [parts.join(" · "), ...(source.error === null ? [] : [t(noteKeyOf(source.error))])],
            badges: badgesOf(t, source, status, reading),
            progress: progressOf(source.id) ?? undefined,
            actions: retryActionsOf(t, commands, source.id, { canRetry, canRetryFacts }),
        }
    }
    return { rowOf, commands, member, board }
}
