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
    slotCardOf,
} from "@/modules/brain"
import { isWaitingOf, mapSlot, useSlotLabels } from "@/hooks/slot"
import { navigation } from "@/modules/i18n"
import { brainTabHref, workspaceHref } from "@/modules/routes"
import type { BrainPageHeading, DataSlot, PublicAskView, PublicBrainView, PublicFormView, PublicTableRowView, SlotLabels } from "@/modules/types"
import { useBrainPageHeader } from "./useBrainPageHeader"
import { usePublicAsks } from "./usePublicAsks"
import { usePublicDocEditor } from "./usePublicDocEditor"
import { usePublicDocuments } from "./usePublicDocuments"
import { usePublicDraftCommands } from "./usePublicDraftCommands"
import { useWorkspaceId } from "@/hooks/workspaces"

/** The same row geometry while the first read has no data: the table rows and the question rows. */
const ROWS_PLACEHOLDER: ReadonlyArray<PublicTableRowView> = [1, 2, 3].map((n) => ({
    id: `placeholder-${n}`,
    title: "-",
    line: "-",
    kind: "-",
    badge: { label: "-", tone: "neutral" },
    approval: "-",
    href: "",
}))

const ASKS_PLACEHOLDER: ReadonlyArray<PublicAskView> = [1, 2, 3].map((n) => ({
    id: `placeholder-${n}`,
    question: "-",
    line: "-",
    answerHref: "",
    isPending: false,
}))

/** What the page tells the public documents screen. */
interface PublicBrainInput {
    /** The Second Brain heading: trail, title and line. */
    readonly heading: BrainPageHeading
    /** The public document the address opens. */
    readonly docId: string | undefined
}

/** What the two cards of the screen are drawn from. */
interface PublicCardsInput {
    readonly table: DataSlot<ReadonlyArray<PublicTableRowView>>
    readonly asks: DataSlot<ReadonlyArray<PublicAskView>>
    readonly labels: { readonly table: SlotLabels; readonly asks: SlotLabels }
    readonly errorDescription: string
    readonly onRetry: () => void
}

/** The table of documents and the card of questions as the states they draw: rows or skeleton rows, the failure, the count. */
const publicCardsOf = (input: PublicCardsInput) => ({
    table: slotCardOf({
        slot: input.table,
        placeholder: ROWS_PLACEHOLDER,
        labels: input.labels.table,
        errorDescription: input.errorDescription,
        onRetry: input.onRetry,
    }),
    asks: slotCardOf({
        slot: input.asks,
        placeholder: ASKS_PLACEHOLDER,
        labels: input.labels.asks,
        errorDescription: input.errorDescription,
        onRetry: input.onRetry,
    }),
})

/** The values and state of the editor of the open document. */
const formOf = (editor: ReturnType<typeof usePublicDocEditor>): PublicFormView => ({
    title: editor.title,
    body: editor.body,
    error: editor.error,
    isBusy: editor.isPending,
    pendingAction: editor.pendingAction,
})

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
    const workspaceId = useWorkspaceId()
    const labels = useSlotLabels()
    const header = useBrainPageHeader("publicDocs", input.heading)
    const read = usePublicDocuments()
    const editor = usePublicDocEditor(input.docId)
    const asks = usePublicAsks()
    const docHref = (id: string) => workspaceHref(workspaceId, brainTabHref("publicDocs", { doc: id }))
    const close = () => router.replace(workspaceHref(workspaceId, brainTabHref("publicDocs")))
    const draft = usePublicDraftCommands({ docId: input.docId, editor, close })
    const retry = () => {
        read.reload()
        asks.reload()
    }
    const [query, setQuery] = useState("")
    const [tab, setTab] = useState("all")
    const chosen = publicTabOf(tab)
    const documents = "items" in read.slot ? read.slot.items : undefined
    const rows = publicDocsMatching(documents ?? [], chosen, query)
    const cards = publicCardsOf({
        table: mapSlot(read.slot, () => rows.map((one) => publicRowOf(one, t, format, docHref(one.id)))),
        asks: asks.asks,
        labels: { table: labels(t("listEmpty")), asks: labels(p("asksEmpty")) },
        errorDescription: tp("errorBody"),
        onRetry: retry,
    })
    const doc = mapSlot(read.slot, (all) =>
        all.filter((one) => one.id === input.docId).map((one) => publicDraftOf(one, t, p, format)),
    )
    const opened = input.docId === undefined ? null : publicOpenedOf(doc)
    return {
        props: {
            header: header.props,
            panelId: `${header.props.tabs.panelPrefix}publicDocs`,
            copy: publicCopyOf(t, p, tp),
            grid: brainGridOf({ hasAside: false, phone: "main", isWhole: true }),
            table: {
                card: cards.table,
                query,
                tab: chosen,
                tabs: publicTabsOf(documents, chosen, p),
            },
            main: input.docId === undefined ? { kind: "none" } : { kind: "doc", slot: doc },
            placeholder: PUBLIC_DRAFT_PLACEHOLDER,
            decided: opened === null || opened.isLoading || !read.canWrite ? null : opened.draft,
            opened,
            form: formOf(editor),
            slotLabels: labels(t("listEmpty")),
            asks: cards.asks,
            isWaiting: isWaitingOf(read.slot, asks.asks),
            canWrite: read.canWrite,
            composeHref: workspaceHref(workspaceId, brainTabHref("publicDocs", { compose: "pick" })),
            isRemoveOpen: draft.isRemoveOpen,
            isRemoving: draft.isRemoving,
        },
        on: {
            ...draft.on,
            selectTab: header.on.selectTab,
            search: setQuery,
            setTab,
            clear: () => {
                setQuery("")
                setTab("all")
            },
            back: close,
            retry,
            compose: () => router.push(workspaceHref(workspaceId, brainTabHref("publicDocs", { compose: "pick" }))),
            skipAsk: asks.skip,
        },
    }
}
