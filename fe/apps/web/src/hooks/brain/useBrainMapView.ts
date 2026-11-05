"use client"

import { useMemo, useState } from "react"
import { useTranslations } from "next-intl"
import { useSlotLabels, mapSlot, loadingSlot } from "@/hooks/slot"
import { useQueryKnowledgeSourcesSwr } from "@/hooks/swr"
import {
    MAP_ROOT_ID,
    brainGridOf,
    MAP_STATUS_FILTERS,
    dossierOfFile,
    mapFilesOf,
    mapGraphOf,
    reviewedStatusOf,
    selectionOf,
} from "@/modules/brain"
import type { CategoryView, MapContent, MapStatusFilter, MapStatusOf, MapView } from "@/modules/brain"
import { navigation } from "@/modules/i18n"
import { brainTabHref } from "@/modules/routes"
import { useBrainDossiers } from "./useBrainDossiers"
import { useDossierReviewSummary } from "./useDossierReviewSummary"
import { useMapDetail } from "./useMapDetail"

/** A map of the same shape as a ready one, drawn as geometry while the categories and dossiers are read. */
const PLACEHOLDER: MapContent = {
    nodes: [
        { id: MAP_ROOT_ID, label: "-", isRoot: true, form: "bubble", mark: "-", diameter: 120 },
        ...[1, 2, 3, 4].map((n) => ({
            id: `placeholder-${n}`,
            label: "-",
            form: "bubble" as const,
            mark: "-",
            diameter: 66,
            isPlaceholder: true,
        })),
    ],
    edges: [1, 2, 3, 4].map((n) => ({ id: `placeholder-edge-${n}`, source: MAP_ROOT_ID, target: `placeholder-${n}` })),
}

/** No categories yet: the read has not answered. */
const NO_CATEGORIES: ReadonlyArray<CategoryView> = []

/** No documents yet: the read has not answered. */
const NO_SOURCES: Parameters<typeof mapFilesOf>[0] = []

/** What the map reads from the address and from the desk beside it. */
interface MapViewInput {
    /** The node the address selects. */
    readonly node: string | undefined
    /** The first reads of the page have no data yet. */
    readonly isWaiting: boolean
}

/** What the map gives its block. */
interface BrainMapState {
    readonly view: MapView
    readonly on: { readonly select: (id: string | null) => void; readonly setFilter: (value: string | null) => void }
}

/**
 * The map of the dossiers: every category and dossier as an orbit graph (bubbles sized by their documents, categories ringed and
 * dossiers painted by status, a dossier's documents on the outer ring while it is open), the filter that dims the other statuses,
 * and the side pane for the node the address selects.
 */
export const useBrainMapView = (input: MapViewInput): BrainMapState => {
    const t = useTranslations("secondBrain")
    const router = navigation.useRouter()
    const slotLabels = useSlotLabels()
    const { categories, slot } = useBrainDossiers()
    const sources = useQueryKnowledgeSourcesSwr({})
    const summary = useDossierReviewSummary()
    const { detailOf } = useMapDetail()
    const [filter, setFilter] = useState<MapStatusFilter>("all")
    const all = categories ?? NO_CATEGORIES
    const filesOf = useMemo(() => mapFilesOf(sources.data ?? NO_SOURCES), [sources.data])
    const statusOf: MapStatusOf = (dossier) => reviewedStatusOf(dossier.status, summary.reviewOf(dossier.id)).status
    const selection = selectionOf(all, input.node ?? null)
    const total = all.reduce((sum, category) => sum + category.dossiers.length, 0)
    const words = { root: t("mapRoot"), rootMeta: t("mapRootMeta", { count: total }) }
    const graphSlot = input.isWaiting
        ? loadingSlot<MapContent>()
        : mapSlot(slot, (rows) => mapGraphOf(rows, words, filter, statusOf, filesOf))
    const view: MapView = {
        slot: graphSlot,
        placeholder: PLACEHOLDER,
        slotLabels: slotLabels(t("dossiersEmpty")),
        label: t("mapLabel"),
        emptyLabel: t("dossiersEmpty"),
        filterLabel: t("mapFilterLabel"),
        filters: MAP_STATUS_FILTERS.map((one) => ({
            id: one,
            label: one === "all" ? t("mapFilterAll") : t(`status_${one}`),
        })),
        filter,
        selectedId: selection.kind === "none" ? null : (input.node ?? null),
        detail: detailOf(all, selection, statusOf),
        isWaiting: input.isWaiting,
        grid: brainGridOf({ hasAside: true, phone: input.node === undefined ? "list" : "main", isWhole: false }),
    }
    return {
        view,
        on: {
            select: (picked) => {
                const id = picked === null ? null : (dossierOfFile(all, filesOf, picked)?.id ?? picked)
                router.replace(brainTabHref("map", { node: id ?? undefined }))
            },
            setFilter: (value) => setFilter(MAP_STATUS_FILTERS.find((one) => one === value) ?? "all"),
        },
    }
}
