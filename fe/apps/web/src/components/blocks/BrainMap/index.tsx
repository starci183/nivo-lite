"use client"

import { useMemo, useState } from "react"
import type { ReactNode } from "react"
import { useFormatter, useTranslations } from "next-intl"
import type { PageHeaderContent } from "@starci/grammar/common"
import {
    BRAIN_PANEL_PREFIX,
    DOSSIER_STATUS_TONE,
    MAP_ROOT_ID,
    MAP_STATUS_FILTERS,
    dossierOfFile,
    mapFilesOf,
    mapGraphOf,
    reviewedStatusOf,
    selectionOf,
    sizeLabelOf,
    statusCountsOf,
    useBrainDossiers,
    useBrainPageHeader,
    useDossierReviewSummary,
} from "@/hooks/brain"
import type {
    CategoryView,
    DossierView,
    MapSelection,
    MapStatusFilter,
    MapStatusOf,
    NumberFormatter,
} from "@/hooks/brain"
import { mapSlot, useSlotLabels } from "@/hooks/slot"
import { useQueryKnowledgeSourcesSwr } from "@/hooks/swr"
import { navigation } from "@/modules/i18n"
import { brainDossierHref, brainTabHref } from "@/modules/routes"
import { BrainMapBase } from "./component"
import type { MapContent, MapDetailView } from "./component"

type Translate = ReturnType<typeof useTranslations<"secondBrain">>

/** What the page hands the map tab: the header without its tabs, and the node the address selects. */
interface BrainMapProps {
    readonly header: PageHeaderContent
    readonly node: string | undefined
    /** The findings of the dossier the node selects, drawn by the page in the side pane. */
    readonly findings: ReactNode
}

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

/** A dossier row of the selected category: its name and what is missing, leading to the map with it selected. */
const dossierRowOf = (t: Translate, dossier: DossierView, statusOf: MapStatusOf) => ({
    id: dossier.id,
    label: dossier.name,
    description: dossier.note === null ? null : dossier.note.text,
    href: brainTabHref("map", { node: dossier.id }),
    badge: { label: t(`status_${statusOf(dossier)}`), tone: DOSSIER_STATUS_TONE[statusOf(dossier)] },
})

const categoryTitleOf = (category: CategoryView): string =>
    category.order === null ? category.label : `${String(category.order).padStart(2, "0")} ${category.label}`

/** The side pane for what is selected: the whole set when nothing is, a category with its dossiers, or one dossier. */
const detailOf = (
    t: Translate,
    format: NumberFormatter,
    categories: ReadonlyArray<CategoryView>,
    selection: MapSelection,
    statusOf: MapStatusOf,
): MapDetailView => {
    if (selection.kind === "category") {
        const { category } = selection
        return {
            title: categoryTitleOf(category),
            badges: [],
            lines: [
                t("categoryMeta", { count: category.documentCount, size: sizeLabelOf(category.sizeBytes, format) }),
            ],
            rowsLabel: t("mapCategoryRows"),
            rows: category.dossiers.map((dossier) => dossierRowOf(t, dossier, statusOf)),
            action: null,
        }
    }
    if (selection.kind === "dossier") {
        const { dossier } = selection
        return {
            title: dossier.name,
            badges: [
                {
                    id: "status",
                    label: t(`status_${statusOf(dossier)}`),
                    tone: DOSSIER_STATUS_TONE[statusOf(dossier)],
                },
                { id: "documents", label: t("dossierDocuments", { count: dossier.documentCount }), tone: "muted" },
            ],
            lines: dossier.note === null ? [] : [dossier.note.text],
            rowsLabel: t("mapCategoryRows"),
            rows: [],
            action: { label: t("mapOpenDossier"), href: brainDossierHref(dossier.id) },
        }
    }
    return {
        title: t("mapDetailTitle"),
        badges: [],
        lines: [t("mapDetailHint")],
        rowsLabel: t("mapStatusRows"),
        rows: statusCountsOf(categories, statusOf).map((one) => ({
            id: one.status,
            label: t(`status_${one.status}`),
            description: null,
            href: null,
            badge: { label: String(one.count), tone: DOSSIER_STATUS_TONE[one.status] },
        })),
        action: null,
    }
}

/**
 * The connected map tab of the Second Brain: every category and dossier as an orbit graph (bubbles sized by their documents,
 * categories ringed and dossiers painted by status, a dossier's documents on the outer ring while it is open), a filter that
 * dims the other statuses, and a side pane for the node the address selects.
 */
export const BrainMap = (props: BrainMapProps) => {
    const t = useTranslations("secondBrain")
    const formatter = useFormatter()
    const format: NumberFormatter = (value, digits) => formatter.number(value, { maximumFractionDigits: digits })
    const router = navigation.useRouter()
    const slotLabels = useSlotLabels()
    const { categories, slot, reload } = useBrainDossiers()
    const { data: sources } = useQueryKnowledgeSourcesSwr({})
    const filesOf = useMemo(() => mapFilesOf(sources ?? []), [sources])
    const header = useBrainPageHeader("map", props.header)
    const summary = useDossierReviewSummary()
    const statusOf: MapStatusOf = (dossier) => reviewedStatusOf(dossier.status, summary.reviewOf(dossier.id)).status
    const [filter, setFilter] = useState<MapStatusFilter>("all")
    const [isDetailOpen, setDetailOpen] = useState(false)
    const all = categories ?? []
    const selection = selectionOf(all, props.node ?? null)
    const total = all.reduce((sum, category) => sum + category.dossiers.length, 0)
    const words = { root: t("mapRoot"), rootMeta: t("mapRootMeta", { count: total }) }
    const select = (picked: string | null) => {
        const id = picked === null ? null : (dossierOfFile(all, filesOf, picked)?.id ?? picked)
        router.replace(brainTabHref("map", { node: id ?? undefined }))
        setDetailOpen(id !== null && id !== MAP_ROOT_ID)
    }
    return (
        <BrainMapBase
            shape={{ findings: selection.kind === "dossier" ? props.findings : null }}
            props={{
                header,
                panelId: `${BRAIN_PANEL_PREFIX}map`,
                gridLabel: t("mapGridLabel"),
                mapLabel: t("mapLabel"),
                emptyLabel: t("dossiersEmpty"),
                detailLabel: t("mapDetailLabel"),
                detailCloseLabel: t("mapDetailClose"),
                isDetailOpen,
                filterLabel: t("mapFilterLabel"),
                filters: MAP_STATUS_FILTERS.map((one) => ({
                    id: one,
                    label: one === "all" ? t("mapFilterAll") : t(`status_${one}`),
                })),
                filter,
                selectedId: selection.kind === "none" ? null : (props.node ?? null),
                slot: mapSlot(slot, (rows) => mapGraphOf(rows, words, filter, statusOf, filesOf)),
                placeholder: PLACEHOLDER,
                slotLabels: slotLabels(t("dossiersEmpty")),
                detail: detailOf(t, format, all, selection, statusOf),
            }}
            on={{
                select,
                setFilter: (value) => setFilter(MAP_STATUS_FILTERS.find((one) => one === value) ?? "all"),
                retry: reload,
                detailOpenChange: setDetailOpen,
            }}
        />
    )
}
