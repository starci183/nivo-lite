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
import { mapSlot, useSlotLabels } from "@/hooks/slot"
import { KnowledgeSourcePanelBase } from "./component"

/** Props for the connected document. */
interface KnowledgeSourcePanelProps {
    /** The document of the address; undefined while the page is only a skeleton. */
    readonly sourceId: string | undefined
}

/** The connected document: indexes it again, changes who may read it, deletes it. */
export const KnowledgeSourcePanel = (props: KnowledgeSourcePanelProps) => {
    const t = useTranslations("knowledge")
    const format = useFormatter()
    const slotLabels = useSlotLabels()
    const member = useWorkspaceMember()
    const { detail, slot, reload, isMissing } = useKnowledgeSource(props.sourceId)
    if (isMissing) notFound()
    const source = detail?.source ?? null
    const commands = useSourceCommands(source?.id ?? "")
    const isPublic = source?.visibility === "public"
    const status = source?.status ?? "queued"
    const isBusy = commands.busy !== null
    return (
        <KnowledgeSourcePanelBase
            props={{
                doc: mapSlot(slot, (found) => ({
                    section: {
                        id: "knowledge-source-title",
                        title: found.source.title,
                        description: t("detailMeta", {
                            when: format.dateTime(new Date(found.source.createdAt), { dateStyle: "medium" }),
                        }),
                        failTitle: t("detailFailed"),
                    },
                    head: {
                        statusLabel: t(DOCUMENT_STATUS_KEYS[status]),
                        statusTone: DOCUMENT_STATUS_TONE[status],
                        visibilityLabel: t(isPublic ? "visPublicLong" : "visInternalLong"),
                        note: found.source.error ? t(noteKeyOf(found.source.error)) : undefined,
                        progress:
                            isDocumentActive(status) && found.source.progress > 0 ? found.source.progress : undefined,
                        canWrite: member.canWrite,
                        reindexLabel: commands.busy === "reindex" ? t("reindexing") : t("reindex"),
                        visibilityActionLabel: t(isPublic ? "makeInternal" : "makePublic"),
                        deleteLabel: commands.busy === "delete" ? t("deleting") : t("delete"),
                        deleteQuestion: t("delete"),
                        deleteConfirm: t("deleteConfirm"),
                        cancelLabel: t("addCancel"),
                        contentTitle: t("contentTitle"),
                        content: found.source.content,
                        isBusy,
                        isReindexDisabled: isDocumentActive(status),
                    },
                })),
                docLabels: slotLabels(t("detailFailed")),
                passages: mapSlot(slot, (found) =>
                    found.chunks.map((chunk) => ({
                        id: chunk.id,
                        title: `#${chunk.ord + 1}`,
                        lines: [chunk.content],
                        badges: [
                            {
                                label: t(chunk.hasEmbedding ? "passageVector" : "passageKeyword"),
                                tone: "neutral" as const,
                            },
                        ],
                    })),
                ),
                passagesLabels: slotLabels(t("noVectors")),
                passagesLabel: t("passagesTitle"),
                isPending: isBusy,
            }}
            on={{
                reindex: commands.reindex,
                toggleVisibility: () => commands.setVisibility(isPublic ? "internal" : "public"),
                remove: commands.remove,
                retry: reload,
            }}
        />
    )
}
