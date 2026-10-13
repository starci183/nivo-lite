"use client"

import { useFormatter, useTranslations } from "next-intl"
import {
    DOCUMENT_STATUS_TONE,
    DOCUMENT_STATUS_KEYS,
    isDocumentActive,
    noteKeyOf,
    useKnowledgeRealtime,
    useSourceCommands,
} from "@/hooks/knowledge"
import type { CommandActions } from "@/hooks/knowledge"
import { writeCommandWait } from "@/modules/db/knowledge/write-command-wait"
import { writeCommand } from "@/modules/db/knowledge/write-command"
import { navigation } from "@/modules/i18n"
import type { DocumentPassage, KnowledgeDocumentDetail } from "@/modules/types"
import { KnowledgeSourcePanelBase } from "./component"
import type { KnowledgeSourcePanelBaseProps } from "./component"

/** Props for the connected document. */
interface KnowledgeSourcePanelProps {
    readonly workspaceId: string
    /** Null while the page loads. */
    readonly source: KnowledgeDocumentDetail | null
    readonly chunks: ReadonlyArray<DocumentPassage>
    readonly canWrite: boolean
}

const ACTIONS: CommandActions = { write: writeCommand, wait: writeCommandWait }

/** The connected document: follows the worker live, indexes it again, changes who may read it, deletes it. */
export const KnowledgeSourcePanel = (props: KnowledgeSourcePanelProps) => {
    const t = useTranslations("knowledge")
    const format = useFormatter()
    const router = navigation.useRouter()
    const source = props.source
    const commands = useSourceCommands(props.workspaceId, source?.id ?? "", ACTIONS)
    useKnowledgeRealtime(props.workspaceId, ["knowledge_sources"], () => router.refresh())
    const isPublic = source?.visibility === "public"
    const status = source?.status ?? "queued"
    const metaOf = (): string =>
        source === null
            ? t("title")
            : t("detailMeta", { when: format.dateTime(new Date(source.createdAt), { dateStyle: "medium" }) })
    const view: KnowledgeSourcePanelBaseProps["props"] = {
        list: {
            section: {
                id: "knowledge-source-title",
                title: source?.title ?? t("title"),
                description: metaOf(),
                failTitle: t("detailFailed"),
                error: commands.errorKey === null ? undefined : t(commands.errorKey),
            },
            label: t("passagesTitle"),
            rows: props.chunks.map((chunk) => ({
                id: chunk.id,
                title: `#${chunk.ord + 1}`,
                lines: [chunk.content],
                badges: [{ label: t(chunk.hasEmbedding ? "passageVector" : "passageKeyword"), tone: "neutral" }],
            })),
            isLoading: source === null,
            isPending: commands.busy !== null,
            emptyTitle: t("noVectors"),
            emptyBody: t("passagesHint"),
        },
        head: {
            statusLabel: t(DOCUMENT_STATUS_KEYS[status]),
            statusTone: DOCUMENT_STATUS_TONE[status],
            visibilityLabel: t(isPublic ? "visPublicLong" : "visInternalLong"),
            note: source?.error ? t(noteKeyOf(source.error)) : undefined,
            progress: source && isDocumentActive(status) && source.progress > 0 ? source.progress : undefined,
            canWrite: props.canWrite && source !== null,
            reindexLabel: commands.busy === "reindex" ? t("reindexing") : t("reindex"),
            visibilityActionLabel: t(isPublic ? "makeInternal" : "makePublic"),
            deleteLabel: commands.busy === "delete" ? t("deleting") : t("delete"),
            deleteQuestion: t("delete"),
            deleteConfirm: t("deleteConfirm"),
            cancelLabel: t("addCancel"),
            contentTitle: t("contentTitle"),
            content: source?.content ?? "",
            isBusy: commands.busy !== null,
            isSkeleton: source === null,
        },
    }
    return (
        <KnowledgeSourcePanelBase
            props={view}
            on={{
                reindex: commands.reindex,
                toggleVisibility: () => commands.setVisibility(isPublic ? "internal" : "public"),
                remove: commands.remove,
            }}
        />
    )
}
