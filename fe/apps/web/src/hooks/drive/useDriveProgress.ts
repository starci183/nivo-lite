"use client"

import { useFormatter, useTranslations } from "next-intl"
import { useCallback, useMemo } from "react"
import { DOCUMENT_STATUS_KEYS, noteKeyOf, useLibraryCommands } from "@/hooks/knowledge"
import { mapSlot, slotOfSwr } from "@/hooks/slot"
import { useQueryKnowledgeSourcesSwr } from "@/hooks/swr"
import { toKnowledgeDocument } from "@/modules/documents"
import type { ConnectionLineView, ConnectionTone, DataSlot, KnowledgeDocument } from "@/modules/types"
import { DRIVE_ORIGIN, DRIVE_PROGRESS_POLL_MS } from "./drive.shared"

const TONES: Readonly<Record<KnowledgeDocument["status"], ConnectionTone>> = {
    pending: "neutral",
    queued: "neutral",
    reading: "accent",
    indexing: "accent",
    extracting_facts: "accent",
    ready: "success",
    failed: "danger",
    blocked_credits: "warning",
}

/**
 * The sources that came from Google Drive and where each one stands, newest first: Drive sends no webhook, so the page asks the job
 * queue every few seconds. A failed file carries its note and a retry; a file that ran out of credit says it is saved and searchable.
 */
export const useDriveProgress = (enabled = true) => {
    const t = useTranslations("driveConnection")
    const tk = useTranslations("knowledge")
    const format = useFormatter()
    const read = useQueryKnowledgeSourcesSwr({ origin: DRIVE_ORIGIN }, DRIVE_PROGRESS_POLL_MS, enabled)
    const commands = useLibraryCommands()
    const documents = useMemo(() => read.data?.map(toKnowledgeDocument), [read.data])
    const { retry } = commands

    const lineOf = useCallback(
        (source: KnowledgeDocument): ConnectionLineView => {
            const visibility = source.visibility === "public" ? t("visPublic") : t("visInternal")
            const added = format.dateTime(new Date(source.createdAt), { dateStyle: "short", timeStyle: "short" })
            const note = source.error === null ? undefined : tk(noteKeyOf(source.error))
            return {
                id: source.id,
                title: source.title,
                description: note ?? [visibility, added].join(" · "),
                badge: { label: tk(DOCUMENT_STATUS_KEYS[source.status]), tone: TONES[source.status] },
                ...(source.status === "failed" ? { action: { label: t("retry"), run: () => retry(source.id) } } : {}),
            }
        },
        [t, tk, format, retry],
    )

    const lines: DataSlot<ReadonlyArray<ConnectionLineView>> = mapSlot(
        slotOfSwr({ data: documents, error: read.error, isLoading: read.isLoading }),
        (sources) => sources.toSorted((a, b) => b.createdAt.localeCompare(a.createdAt)).map(lineOf),
    )
    return {
        lines,
        count: documents?.length ?? 0,
        reload: () => void read.mutate(),
    }
}
