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
import { navigation } from "@/modules/i18n"
import { brainTabHref, knowledgeSourceHref } from "@/modules/routes"
import type { KnowledgeRowView } from "@/components/composites/KnowledgeRows"
import type { KnowledgeDocument } from "@/modules/types"
import { KnowledgeLibraryBase } from "./component"

type Translate = ReturnType<typeof useTranslations<"knowledge">>

/**
 * Where a document stands in one word: still being read, learnt (with how many facts it gave, when the viewer may see them),
 * failed, or what else holds it back.
 */
const statusLabelOf = (t: Translate, source: KnowledgeDocument, learnedFacts: number | null): string => {
    if (isDocumentActive(source.status)) return t("libReading")
    if (source.status === "failed") return t("libFailed")
    if (source.status !== "ready") return t(DOCUMENT_STATUS_KEYS[source.status])
    return learnedFacts === null ? t("libLearnedPlain") : t("libLearned", { count: learnedFacts })
}

/** The agent a document is kept for, or every agent. */
const moduleLabelOf = (t: Translate, source: KnowledgeDocument): string =>
    source.module !== null && isAgentModule(source.module) ? t(`module_${source.module}`) : t("moduleAll")

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
    const { sources, isLoading } = useKnowledgeSources()
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
        const status = statusLabelOf(t, source, member.canWrite ? factsOf(source) : null)
        const canRetry =
            member.canWrite && source.status === "failed" && source.error !== null && !isReadyNote(source.error)
        return {
            id: source.id,
            title: source.title,
            href: knowledgeSourceHref(source.id),
            lines: [parts.join(" · "), ...(source.error === null ? [] : [t(noteKeyOf(source.error))])],
            badges: [
                { label: status, tone: DOCUMENT_STATUS_TONE[source.status] },
                {
                    label: t(source.visibility === "public" ? "vis_public" : "vis_internal"),
                    tone: source.visibility === "public" ? ("accent" as const) : ("neutral" as const),
                },
                { label: moduleLabelOf(t, source), tone: "neutral" as const },
            ],
            progress:
                isDocumentActive(source.status) && source.progress > 0
                    ? { label: status, value: source.progress }
                    : undefined,
            actions: canRetry ? [{ id: "retry", label: t("retry"), onPress: () => commands.retry(source.id) }] : [],
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
                    rows: shown.map(rowOf),
                    isLoading: isLoading || member.isLoading || board.isLoading || sources === undefined,
                    isPending: commands.retrying.size > 0,
                    emptyTitle: t("emptyTitle"),
                    emptyBody: t("emptyBody"),
                },
                filterLabel: t("filterModule"),
                filterOptions: [
                    { id: "all", label: t("filterAll") },
                    ...AGENT_MODULES.map((key) => ({ id: key, label: t(`module_${key}`) })),
                ],
                filter: props.module,
            }}
            on={{ setFilter: filterTo }}
        />
    )
}
