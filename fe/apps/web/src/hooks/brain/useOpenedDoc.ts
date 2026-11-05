"use client"

import { notFound } from "next/navigation"
import { useFormatter, useTranslations } from "next-intl"
import { useKnowledgeSource, useSourceCommands } from "@/hooks/knowledge"
import { mapSlot } from "@/hooks/slot"
import { docBodyOf, docChipOf, docFactsOf, docHeadOf } from "@/modules/documents"
import type { DataSlot, DocBodyView, DocOpenedView } from "@/modules/types"
import type { KnowledgeRowOfView } from "./useKnowledgeRowOf"

/** The opened document: its head, body and facts from the one read of the document, with the commands that change it. */
export interface OpenedDocView {
    readonly opened: DataSlot<DocOpenedView<DocBodyView>>
    readonly commands: ReturnType<typeof useSourceCommands>
    readonly reload: () => undefined
    readonly title: string | undefined
}

/** The opened document, from the one read of the document and the commands of its row. */
export const useOpenedDoc = (id: string | undefined, row: KnowledgeRowOfView): OpenedDocView => {
    const t = useTranslations("knowledge")
    const format = useFormatter()
    const { detail, slot, reload, isMissing } = useKnowledgeSource(id)
    if (isMissing) notFound()
    const commands = useSourceCommands(detail?.source.id ?? "")
    const opened = mapSlot(slot, (found) => {
        const source = found.source
        const rowView = row.rowOf(source)
        return {
            head: docHeadOf(
                t,
                format,
                source,
                {
                    canWrite: row.member.canWrite,
                    busy: commands.busy,
                    chip: docChipOf(rowView),
                    rowActions: rowView.actions.map((action) => ({
                        id: action.id,
                        label: action.id === "retry-facts" ? t("retryFacts") : action.label,
                    })),
                },
                found.chunks.length,
            ),
            body: docBodyOf(t, source, found.chunks),
            facts: docFactsOf(t, format, source),
        }
    })
    return { opened, commands, reload, title: detail?.source.title }
}
