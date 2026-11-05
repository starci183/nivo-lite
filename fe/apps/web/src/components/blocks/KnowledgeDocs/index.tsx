"use client"

import { useTranslations } from "next-intl"
import { BRAIN_PANEL_PREFIX, useKnowledgeDocs } from "@/hooks/brain"
import { useAddPreset, useDocsAddress, useKnowledgeAddDrawer } from "@/hooks/knowledge"
import type { BrainPageHeading, DocsSelection } from "@/modules/types"
import { KnowledgeDocsBase } from "./component"

/** What the pages tell the documents screen. */
interface KnowledgeDocsProps {
    /** The Second Brain heading: trail, title and line. */
    readonly heading: BrainPageHeading
    /** What the address opens: nothing, a document or the base knowledge. */
    readonly selection: DocsSelection
}

/**
 * The connected documents screen of the Second Brain: the list with its filters, the opened document or item of the base knowledge,
 * its facts and the documents worth adding, and the drawer that adds them. It serves the tab itself and the addresses of one
 * document and of the base knowledge.
 */
export const KnowledgeDocs = (props: KnowledgeDocsProps) => {
    const t = useTranslations("knowledge")
    const view = useKnowledgeDocs(props)
    const add = useAddPreset()
    const address = useDocsAddress()
    const drawer = useKnowledgeAddDrawer({
        isOpen: add.isOpen,
        readOnlyNote: t("readOnlyNote"),
        module: address.module,
        preset: add.preset,
        presetKey: add.key,
    })
    return <KnowledgeDocsBase props={{ ...view.props, panelId: `${BRAIN_PANEL_PREFIX}sources`, drawer }} on={view.on} />
}
