"use client"

import { useMemo, useState } from "react"
import { useTranslations } from "next-intl"
import { isWaitingOf, loadingSlot, mapSlot, useSlotLabels } from "@/hooks/slot"
import {
    FACT_MAP_KINDS,
    FACT_MAP_KIND_TONE,
    FACT_MAP_SHOP_VIEW,
    factMapGraphOf,
    factMapPaneOf,
    factMapSelectionIdOf,
    type FactDrawerWords,
    type FactKey,
    type FactMapRef,
    type FactMapView,
    type FactMode,
} from "@/modules/brain"
import { navigation } from "@/modules/i18n"
import { brainTabHref, workspaceHref } from "@/modules/routes"
import { useWorkspaceId } from "@/hooks/workspaces"
import { useAgentLenses } from "./useAgentLenses"
import { useFactBatch } from "./useFactBatch"
import { useFailureToast } from "./useFailureToast"
import type { BrainBoard } from "./useBrainBoard"

/** What the map of the facts is read against. */
export interface FactMapInput {
    readonly board: BrainBoard
    readonly keys: ReadonlyArray<FactKey>
    readonly workspaceName: string
    readonly words: FactDrawerWords
    /** Opens the comparison of a key that asks for a choice. */
    readonly compare: (key: string) => void
}

/** What the facts card gives its block: the way it is drawn, the map and what they do. */
export interface FactMapState {
    readonly mode: FactMode
    readonly view: FactMapView
    readonly on: {
        readonly setMode: (id: string) => void
        readonly select: (id: string | null) => void
        readonly setView: (id: string) => void
        readonly approve: () => void
        readonly edit: () => void
        readonly compare: () => void
    }
}

/** The translation key of each kind's count line. */
const KIND_COUNT_KEYS = { settled: "kindSettled", fresh: "kindFresh", conflict: "kindConflict", retired: "kindConflict" } as const

/** The translation key of each kind's legend entry. */
const KIND_LEGEND_KEYS = { settled: "legendConfirmed", fresh: "legendProposed", conflict: "legendConflict" } as const

/** A map of the same shape as a ready one, drawn as geometry while the facts are read. */
const PLACEHOLDER: FactMapView["placeholder"] = {
    nodes: [
        { id: "root", label: "-", isRoot: true, form: "bubble", mark: "-", diameter: 120 },
        ...[1, 2, 3, 4].map((n) => ({
            id: `placeholder-${n}`,
            label: "-",
            form: "bubble" as const,
            mark: "-",
            diameter: 66,
            isPlaceholder: true,
        })),
    ],
    edges: [1, 2, 3, 4].map((n) => ({ id: `placeholder-edge-${n}`, source: "root", target: `placeholder-${n}` })),
}

const refOf = (refs: ReadonlyMap<string, FactMapRef>, id: string | null): FactMapRef | null =>
    id === null ? null : (refs.get(id) ?? null)

/**
 * The map of the shop's brain inside the facts card: the same facts as the list, drawn as subjects, facts and the documents they cite,
 * seen as the whole shop or as one agent reads them. A node opens a side pane; Approve and Edit use the commands of the list.
 */
export const useBrainFactMap = (input: FactMapInput): FactMapState => {
    const t = useTranslations("brainFactMap")
    const router = navigation.useRouter()
    const workspaceId = useWorkspaceId()
    const batch = useFactBatch()
    const failed = useFailureToast()
    const read = useAgentLenses()
    const slotLabels = useSlotLabels()
    const [mode, setMode] = useState<FactMode>("map")
    const [selectedId, setSelectedId] = useState<string | null>(null)
    const [viewId, setViewId] = useState(FACT_MAP_SHOP_VIEW)
    const lenses = read.lenses ?? []
    const lens = lenses.find((one) => one.id === viewId) ?? null
    const count = input.keys.filter((one) => one.kind !== "retired").length
    const rootMeta = t("rootMeta", { count })
    const graph = useMemo(
        () => factMapGraphOf(input.keys, { root: input.workspaceName, rootMeta }, lens),
        [input.keys, input.workspaceName, rootMeta, lens],
    )
    const ref = refOf(graph.refs, selectedId)
    const selectedKey = ref === null || ref.kind === "subject" ? null : ref.key
    const pane = factMapPaneOf({
        ref,
        keys: input.keys,
        lenses,
        canWrite: input.board.canWrite,
        isPending: batch.isPending,
        words: {
            drawer: input.words,
            documentsTitle: t("documentsTitle"),
            readersTitle: t("readersTitle"),
            customerName: t("viewChatbot"),
            approve: t("approve"),
            edit: t("edit"),
            compare: t("compare"),
            kindLabel: (kind, count) =>
                t(KIND_COUNT_KEYS[kind], { count }),
        },
    })
    const isWaiting = read.isLoading || isWaitingOf(input.board.slot)
    const ready = mapSlot(input.board.slot, () => ({ nodes: graph.nodes, edges: graph.edges }))
    const readySlot: FactMapView["slot"] = "items" in ready && graph.nodes.length <= 1 ? { isEmpty: true } : ready
    const slot: FactMapView["slot"] = isWaiting ? loadingSlot<FactMapView["placeholder"]>() : readySlot
    const lensLabel = (one: (typeof lenses)[number]): string =>
        one.kind === "customer" ? t("viewChatbot") : (one.name ?? one.module ?? one.id)
    const view: FactMapView = {
        slot,
        placeholder: PLACEHOLDER,
        slotLabels: slotLabels(t("empty")),
        label: t("mapLabel"),
        emptyLabel: t("empty"),
        selectedId,
        viewLabel: t("viewLabel"),
        views: [{ id: FACT_MAP_SHOP_VIEW, label: t("viewShop") }, ...lenses.map((one) => ({ id: one.id, label: lensLabel(one) }))],
        viewId: lens === null ? FACT_MAP_SHOP_VIEW : lens.id,
        pane,
        paneLabel: t("paneLabel"),
        paneEmptyTitle: t("paneEmptyTitle"),
        paneEmptyBody: t("paneEmptyBody"),
        readersNone: t("readersNone"),
        legend: FACT_MAP_KINDS.map((kind) => ({
            id: kind,
            label: t(KIND_LEGEND_KEYS[kind]),
            tone: FACT_MAP_KIND_TONE[kind],
        })),
        documentLegend: t("legendDocument"),
        isWaiting,
    }
    const one = selectedKey === null ? undefined : input.keys.find((each) => each.key === selectedKey)
    return {
        mode,
        view,
        on: {
            setMode: (id) => setMode(id === "map" ? "map" : "list"),
            select: (id) => setSelectedId(factMapSelectionIdOf(graph, id)),
            setView: (id) => setViewId(id),
            approve: () => {
                if (one === undefined || !input.board.canWrite || one.kind !== "fresh") return
                batch
                    .run([{ kind: "decide", request: { id: one.lead.id, action: "apply" } }], () => t("approved"))
                    .catch(failed)
            },
            edit: () => {
                if (one === undefined) return
                router.push(workspaceHref(workspaceId, brainTabHref("facts", { edit: one.lead.id })))
            },
            compare: () => {
                if (one !== undefined) input.compare(one.key)
            },
        },
    }
}
