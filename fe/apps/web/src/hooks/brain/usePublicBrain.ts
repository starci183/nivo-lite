"use client"

import { useFormatter, useTranslations } from "next-intl"
import { useState } from "react"
import {
    PUBLIC_DRAFT_PLACEHOLDER,
    brainGridOf,
    publicCopyOf,
    publicDocsMatching,
    publicDraftOf,
    publicOpenedOf,
    publicRowOf,
    publicTabOf,
    publicTabsOf,
} from "@/modules/brain"
import { isWaitingOf, mapSlot, useSlotLabels } from "@/hooks/slot"
import { navigation } from "@/modules/i18n"
import { brainTabHref } from "@/modules/routes"
import type { BrainPageHeading, PublicBrainView } from "@/modules/types"
import { useBrainPageHeader } from "./useBrainPageHeader"
import { usePublicAsks } from "./usePublicAsks"
import { usePublicDocEditor } from "./usePublicDocEditor"
import { usePublicDocuments } from "./usePublicDocuments"
import { usePublicDraftCommands } from "./usePublicDraftCommands"

/** What the page tells the public documents screen. */
interface PublicBrainInput {
    /** The Second Brain heading: trail, title and line. */
    readonly heading: BrainPageHeading
    /** The public document the address opens. */
    readonly docId: string | undefined
}

/**
 * Everything the public documents screen draws and calls: the documents with their filter tabs and search, the open one as an
 * editable draft with its commands, and the customer questions nobody answered yet. The address keeps the open document.
 */
export const usePublicBrain = (input: PublicBrainInput): PublicBrainView => {
    const t = useTranslations("publicBrain")
    const p = useTranslations("brainPublic")
    const tp = useTranslations("pane")
    const format = useFormatter()
    const router = navigation.useRouter()
    const labels = useSlotLabels()
    const header = useBrainPageHeader("publicDocs", input.heading)
    const read = usePublicDocuments()
    const editor = usePublicDocEditor(input.docId)
    const asks = usePublicAsks()
    const close = () => router.replace(brainTabHref("publicDocs"))
    const draft = usePublicDraftCommands({ docId: input.docId, editor, close })
    const [query, setQuery] = useState("")
    const [tab, setTab] = useState("all")
    const chosen = publicTabOf(tab)
    const documents = "items" in read.slot ? read.slot.items : undefined
    const rows = publicDocsMatching(documents ?? [], chosen, query)
    const doc = mapSlot(read.slot, (all) =>
        all.filter((one) => one.id === input.docId).map((one) => publicDraftOf(one, t, p, format)),
    )
    const opened = input.docId === undefined ? null : publicOpenedOf(doc)
    return {
        props: {
            header: header.props,
            panelId: `${header.props.tabs.panelPrefix}publicDocs`,
            copy: publicCopyOf(t, p, tp),
            grid: brainGridOf({ hasAside: true, phone: input.docId === undefined ? "list" : "main", isWhole: false }),
            list: {
                slot: mapSlot(read.slot, () => rows.map((one) => publicRowOf(one, t, format))),
                slotLabels: labels(t("listEmpty")),
                query,
                tab: chosen,
                tabs: publicTabsOf(documents, chosen, p),
                selectedId: input.docId ?? null,
            },
            main: input.docId === undefined ? { kind: "none" } : { kind: "doc", slot: doc },
            placeholder: PUBLIC_DRAFT_PLACEHOLDER,
            decided: opened === null || opened.isLoading || !read.canWrite ? null : opened.draft,
            opened,
            form: {
                title: editor.title,
                body: editor.body,
                error: editor.error,
                isBusy: editor.isPending,
                pendingAction: editor.pendingAction,
            },
            asks: asks.asks,
            asksLabels: labels(p("asksEmpty")),
            isWaiting: isWaitingOf(read.slot, asks.asks),
            canWrite: read.canWrite,
            composeHref: brainTabHref("publicDocs", { compose: "pick" }),
            isRemoveOpen: draft.isRemoveOpen,
            isRemoving: draft.isRemoving,
        },
        on: {
            ...draft.on,
            reviewAll: header.on.reviewAll,
            selectTab: header.on.selectTab,
            select: (id) => router.push(brainTabHref("publicDocs", { doc: id })),
            search: setQuery,
            setTab,
            clear: () => {
                setQuery("")
                setTab("all")
            },
            back: close,
            retry: () => {
                read.reload()
                asks.reload()
            },
            compose: () => router.push(brainTabHref("publicDocs", { compose: "pick" })),
            skipAsk: asks.skip,
        },
    }
}
