"use client"

import { useFormatter, useTranslations } from "next-intl"
import { useState } from "react"
import { useDocsAddress, useKnowledgeDocIdeas, useKnowledgeSources, useNivoKnowledge } from "@/hooks/knowledge"
import { isWaitingOf, loadingSlot } from "@/hooks/slot"
import { brainGridOf } from "@/modules/brain"
import { docsCopyOf, docsMainViewOf, docsNivoSlotOf, docsTrailOf, nivoOpenedOf } from "@/modules/documents"
import { brainTabHref } from "@/modules/routes"
import type { BrainPageHeading, DocsSelection, KnowledgeDocsView } from "@/modules/types"
import { useBrainPageHeader } from "./useBrainPageHeader"
import { useDocsList } from "./useDocsList"
import { useFailureToast } from "./useFailureToast"
import { useKnowledgeDocsCommands } from "./useKnowledgeDocsCommands"
import { useKnowledgeRowOf } from "./useKnowledgeRowOf"
import { useOpenedDoc } from "./useOpenedDoc"
import { useWaitingFactCount } from "./useWaitingFactCount"

/** What the page tells the documents screen. */
interface KnowledgeDocsInput {
    /** The heading of the Second Brain (trail, title, line), without the name of the open document. */
    readonly heading: BrainPageHeading
    readonly selection: DocsSelection
}

/**
 * Everything the documents screen of the Second Brain draws and calls: the list with its search, filters and agent, the opened
 * document (or item of the base knowledge) with its commands, its facts and the suggestions of documents worth adding. The address
 * keeps the search, the filter, the agent and the open item.
 */
export const useKnowledgeDocs = (input: KnowledgeDocsInput): KnowledgeDocsView => {
    const t = useTranslations("knowledge")
    const tp = useTranslations("pane")
    const brain = useTranslations("secondBrain")
    const format = useFormatter()
    const address = useDocsAddress()
    const sources = useKnowledgeSources()
    const row = useKnowledgeRowOf(sources.live)
    const nivo = useNivoKnowledge()
    const ideas = useKnowledgeDocIdeas(useFailureToast())
    const waiting = useWaitingFactCount()
    const selection = input.selection
    const doc = useOpenedDoc(selection.kind === "doc" ? selection.id : undefined, row)
    const [isRemoveOpen, setIsRemoveOpen] = useState(false)
    const [hiddenFor, setHiddenFor] = useState<string | null>(null)
    const { list, chosen, selectedId } = useDocsList({ selection, row, sources, nivo })
    const nivoOpened = docsNivoSlotOf(nivo.slot, chosen === undefined ? undefined : nivoOpenedOf(t, format, chosen))
    const isDocPending = selection.kind === "doc" && selection.id === undefined
    const main = docsMainViewOf(selection, isDocPending ? loadingSlot() : doc.opened, nivoOpened)
    const selectedKey = `${selection.kind}:${selectedId ?? ""}`
    const header = useBrainPageHeader("sources", docsTrailOf(input.heading, t, selection, doc.title ?? chosen?.title))
    const nextReview =
        "items" in waiting.slot && waiting.slot.items > 0
            ? { label: brain("nextReview", { count: waiting.slot.items }), href: brainTabHref("todo") }
            : null
    const hasAside =
        (selection.kind !== "none" || ideas.view !== null || nextReview !== null) && hiddenFor !== selectedKey
    const phone =
        selection.kind === "doc" || (selection.kind === "nivo" && address.item !== undefined) ? "main" : "list"
    const on = useKnowledgeDocsCommands({
        selection,
        selectTab: header.on.selectTab,
        reviewAll: header.on.reviewAll,
        reloads: [sources.reload, nivo.reload, doc.reload],
        doc: { reindex: doc.commands.reindex, remove: doc.commands.remove, row: row.dispatch },
        ideas: { idea: ideas.decide, moreIdeas: ideas.toggleMore },
        overlays: {
            openRemove: () => setIsRemoveOpen(true),
            setRemoveOpen: setIsRemoveOpen,
        },
        hideAside: () => setHiddenFor(selectedKey),
    })
    return {
        props: {
            header: header.props,
            copy: docsCopyOf(t, tp),
            grid: brainGridOf({ hasAside, phone, isWhole: false }),
            list,
            main,
            ideas: ideas.view,
            nextReview,
            isWaiting: isWaitingOf(list.slot, ...(main.kind === "none" ? [] : [main.slot])),
            hasAside,
            isRemoveOpen,
            canAdd: row.member.canWrite,
            addHref: brainTabHref("sources", { ...address.carried, add: "upload" }),
            addLabel: t("addTitle"),
        },
        on,
    }
}
