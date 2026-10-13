"use client"

import { useFormatter, useTranslations } from "next-intl"
import {
    AGENT_MODULES,
    DOCUMENT_STATUS_TONE,
    DOCUMENT_STATUS_KEYS,
    isDocumentActive,
    isReadyNote,
    moduleFilterOf,
    noteKeyOf,
    useKnowledgeSources,
    useLibraryCommands,
    useWorkspaceMember,
} from "@/hooks/knowledge"
import type { AgentModule } from "@/hooks/knowledge"
import { navigation } from "@/modules/i18n"
import { KNOWLEDGE_ROUTES, knowledgeSourceHref } from "@/modules/routes"
import type { KnowledgeRowView } from "@/components/composites/KnowledgeRows"
import type { KnowledgeDocument } from "@/modules/types"
import { KnowledgeLibraryBase } from "./component"

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
    const shown = (sources ?? []).filter((source) => props.module === "all" || source.module === props.module)
    const rowOf = (source: KnowledgeDocument): KnowledgeRowView => {
        const parts = [
            t(`kind_${source.kind}`),
            t(source.visibility === "public" ? "vis_public" : "vis_internal"),
            ...(source.topic === null ? [] : [source.topic]),
            format.dateTime(new Date(source.createdAt), { dateStyle: "medium" }),
        ]
        const status = t(DOCUMENT_STATUS_KEYS[source.status])
        const canRetry =
            member.canWrite && source.status === "failed" && source.error !== null && !isReadyNote(source.error)
        return {
            id: source.id,
            title: source.title,
            href: knowledgeSourceHref(source.id),
            lines: [parts.join(" · "), ...(source.error === null ? [] : [t(noteKeyOf(source.error))])],
            badges: [
                { label: status, tone: DOCUMENT_STATUS_TONE[source.status] },
                ...(source.chunkCount > 0
                    ? [{ label: t("chunks", { count: source.chunkCount }), tone: "neutral" as const }]
                    : []),
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
        router.replace(next === "all" ? KNOWLEDGE_ROUTES.library : `${KNOWLEDGE_ROUTES.library}?module=${next}`)
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
                    isLoading: isLoading || member.isLoading || sources === undefined,
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
