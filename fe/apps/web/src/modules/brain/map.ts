import type { FlowGraphEdge, FlowGraphNode, FlowGraphTone } from "@starci/grammar/common"
import { DOSSIER_STATUS_ORDER } from "./dossiers"
import type { CategoryView, DossierStatus, DossierView } from "./dossiers"

/** The centre of the map: the workspace's brain, which every category hangs from. */
export const MAP_ROOT_ID = "root"

/** The status filter of the map: every dossier, or those standing at one status. */
export const MAP_STATUS_FILTERS = ["all", ...DOSSIER_STATUS_ORDER] as const

/** One of the status filters of the map. */
export type MapStatusFilter = (typeof MAP_STATUS_FILTERS)[number]

/** The tone a dossier node wears by status: held in full is success, partly held a warning, a draft the accent, missing a danger, a template quiet. */
export const MAP_STATUS_TONE: Readonly<Record<DossierStatus, FlowGraphTone>> = {
    present: "success",
    partial: "warning",
    drafted: "accent",
    missing: "danger",
    template: "muted",
}

const CATEGORY_PREFIX = "category:"

/** The id of a category node; the dossier nodes carry the id of their dossier. */
export const mapCategoryId = (categoryId: string): string => `${CATEGORY_PREFIX}${categoryId}`

/** What a selected node of the map is. */
export type MapSelection =
    | { readonly kind: "none" }
    | { readonly kind: "category"; readonly category: CategoryView }
    | { readonly kind: "dossier"; readonly category: CategoryView; readonly dossier: DossierView }

/** The node a selected id names: a category, a dossier with its category, or nothing for the centre and for an id that is gone. */
export const selectionOf = (categories: ReadonlyArray<CategoryView>, selectedId: string | null): MapSelection => {
    if (selectedId === null || selectedId === MAP_ROOT_ID) return { kind: "none" }
    const category = categories.find((one) => mapCategoryId(one.id) === selectedId)
    if (category !== undefined) return { kind: "category", category }
    for (const owner of categories) {
        const dossier = owner.dossiers.find((one) => one.id === selectedId)
        if (dossier !== undefined) return { kind: "dossier", category: owner, dossier }
    }
    return { kind: "none" }
}

/** The words a node of the map is drawn with. */
export interface MapWords {
    readonly root: string
    /** The line under the centre: how many dossiers the map holds. */
    readonly rootMeta: string
}

/** The nodes and edges of the map. */
export interface MapGraph {
    readonly nodes: ReadonlyArray<FlowGraphNode>
    readonly edges: ReadonlyArray<FlowGraphEdge>
}

const isShown = (dossier: DossierView, filter: MapStatusFilter): boolean =>
    filter === "all" || dossier.status === filter

/** The number of a category as it is printed: "01", and the part of its name before the dash ("Members"). */
const categoryLabelOf = (category: CategoryView): string => {
    const name = category.label.split(" - ")[0] ?? category.label
    return category.order === null ? name : `${String(category.order).padStart(2, "0")} ${name}`
}

/**
 * The map of the brain as nodes and edges for a radial layout: the workspace in the centre, its categories on the first ring
 * and the dossiers of each category on the second, each dossier toned by its status. A filter keeps only the dossiers at one
 * status and the categories that still hold one; a category with no dossier at all stays as an unfilled slot.
 */
export const mapGraphOf = (
    categories: ReadonlyArray<CategoryView>,
    words: MapWords,
    filter: MapStatusFilter,
): MapGraph => {
    const nodes: FlowGraphNode[] = [
        { id: MAP_ROOT_ID, label: words.root, description: words.rootMeta, isRoot: true, shape: "circle", size: "lg" },
    ]
    const edges: FlowGraphEdge[] = []
    for (const category of categories) {
        const shown = category.dossiers.filter((one) => isShown(one, filter))
        if (filter !== "all" && shown.length === 0) continue
        const categoryId = mapCategoryId(category.id)
        nodes.push({
            id: categoryId,
            label: categoryLabelOf(category),
            tone: "neutral",
            size: "md",
            count: shown.length,
            isPlaceholder: category.dossiers.length === 0,
        })
        edges.push({ id: `${MAP_ROOT_ID}>${categoryId}`, source: MAP_ROOT_ID, target: categoryId })
        for (const dossier of shown) {
            nodes.push({
                id: dossier.id,
                label: dossier.ref,
                description: dossier.name,
                tone: MAP_STATUS_TONE[dossier.status],
                size: "sm",
                count: dossier.documentCount,
            })
            edges.push({ id: `${categoryId}>${dossier.id}`, source: categoryId, target: dossier.id })
        }
    }
    return { nodes, edges }
}
