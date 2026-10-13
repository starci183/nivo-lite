"use client"

import { notFound } from "next/navigation"
import { useFormatter, useTranslations } from "next-intl"
import {
    DOCUMENT_STATUS_TONE,
    DOCUMENT_STATUS_KEYS,
    isDocumentActive,
    noteKeyOf,
    useKnowledgeSource,
    useSourceCommands,
    useWorkspaceMember,
} from "@/hooks/knowledge"
import { KnowledgeSourcePanelBase } from "./component"
import type { KnowledgeSourcePanelBaseProps } from "./component"

/** Props for the connected document. */
interface KnowledgeSourcePanelProps {
    /** The document of the address; undefined while the page is only a skeleton. */
    readonly sourceId: string | undefined
}

/** The connected document: indexes it again, changes who may read it, deletes it. */
export const KnowledgeSourcePanel = (props: KnowledgeSourcePanelProps) => {
    const t = useTranslations("knowledge")
    const format = useFormatter()
    const member = useWorkspaceMember()
    const { detail, error, isMissing } = useKnowledgeSource(props.sourceId)
    if (isMissing) notFound()
    if (error !== undefined) throw error
    const source = detail?.source ?? null
    const commands = useSourceCommands(source?.id ?? "")
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
            },
            label: t("passagesTitle"),
            rows: (detail?.chunks ?? []).map((chunk) => ({
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
            canWrite: member.canWrite && source !== null,
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
