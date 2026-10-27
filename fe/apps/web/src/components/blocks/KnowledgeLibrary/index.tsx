"use client"

import { useFormatter, useTranslations } from "next-intl"
import {
    AGENT_MODULES,
    DOCUMENT_STATUS_TONE,
    DOCUMENT_STATUS_KEYS,
    isAgentModule,
    isDocumentActive,
    isReadyNote,
    moduleFilterOf,
    noteKeyOf,
    useKnowledgeSources,
    useLibraryCommands,
    useWorkspaceMember,
} from "@/hooks/knowledge"
import type { AgentModule } from "@/hooks/knowledge"
import { useBrainBoard } from "@/hooks/brain"
import { loadingSlot, mapSlot, useSlotLabels } from "@/hooks/slot"
import { navigation } from "@/modules/i18n"
import { brainTabHref, knowledgeSourceHref } from "@/modules/routes"
import type { KnowledgeRowView, RowActionView } from "@/components/composites/KnowledgeRows"
import type { BrainExtraction, KnowledgeDocument } from "@/modules/types"
import { KnowledgeLibraryBase } from "./component"

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
): NonNullable<KnowledgeRowView["badges"]> => [
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
): ReadonlyArray<RowActionView> => [
    ...(choice.canRetry ? [{ id: "retry", label: t("retry"), onPress: () => commands.retry(sourceId) }] : []),
    ...(choice.canRetryFacts
        ? [{ id: "retry-facts", label: t("retry"), onPress: () => commands.reread(sourceId) }]
        : []),
]

/** Props for the connected documents list. */
interface KnowledgeLibraryProps {
    /** The agent the list is filtered to, from the address. */
    readonly module: AgentModule | "all"
}

/** The connected documents list: filters by agent through the address, retries a failed document. */
export const KnowledgeLibrary = (props: KnowledgeLibraryProps) => {
    const t = useTranslations("knowledge")
    const format = useFormatter()
    const router = navigation.useRouter()
    const commands = useLibraryCommands()
    const member = useWorkspaceMember()
    const { sources, slot, reload } = useKnowledgeSources()
    const slotLabels = useSlotLabels()
    const board = useBrainBoard()
    const shown = (sources ?? []).filter((source) => props.module === "all" || source.module === props.module)
    const factsOf = (source: KnowledgeDocument): number =>
        board.facts.filter((fact) =>
            fact.evidence.some((proof) => proof.kind === "document" && proof.ref === source.id),
        ).length
    const rowOf = (source: KnowledgeDocument): KnowledgeRowView => {
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
            href: knowledgeSourceHref(source.id),
            lines: [parts.join(" · "), ...(source.error === null ? [] : [t(noteKeyOf(source.error))])],
            badges: badgesOf(t, source, status, reading),
            progress:
                isDocumentActive(source.status) && source.progress > 0
                    ? { label: status, value: source.progress }
                    : undefined,
            actions: retryActionsOf(t, commands, source.id, { canRetry, canRetryFacts }),
        }
    }
    const filterTo = (value: string | null) => {
        const next = moduleFilterOf(value)
        router.replace(brainTabHref("sources", { module: next === "all" ? undefined : next }))
    }
    return (
        <KnowledgeLibraryBase
            props={{
                list: {
                    section: {
                        id: "knowledge-library-title",
                        title: t("listTitle"),
                        description: t("listCount", { count: shown.length }),
                        failTitle: t("detailFailed"),
                    },
                    label: t("listTitle"),
                    isPending: commands.retrying.size > 0,
                    slot:
                        member.isLoading || board.slot.isLoading
                            ? loadingSlot<ReadonlyArray<KnowledgeRowView>>()
                            : mapSlot(slot, () => shown.map(rowOf)),
                    slotLabels: slotLabels(t("emptyTitle")),
                },
                filterLabel: t("filterModule"),
                selectPlaceholder: t("selectPlaceholder"),
                filterOptions: [
                    { id: "all", label: t("filterAll") },
                    ...AGENT_MODULES.map((key) => ({ id: key, label: t(`module_${key}`) })),
                ],
                filter: props.module,
            }}
            on={{ setFilter: filterTo, retry: reload }}
        />
    )
}
