import { flowGraphDiameter } from "@starci/grammar/common"
import type {
    FlowGraphEdge,
    FlowGraphFill,
    FlowGraphNode,
    FlowGraphRingPart,
    FlowGraphTone,
} from "@starci/grammar/common"
import { DOSSIER_STATUS_ORDER } from "./dossiers"
import { dossierTagOf } from "./finding-view"
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
    /** The workspace in the centre; its bubble prints the first four letters. */
    readonly root: string
    /** The line under the centre: how many dossiers the map holds. */
    readonly rootMeta: string
}

/** The nodes and edges of the map. */
export interface MapGraph {
    readonly nodes: ReadonlyArray<FlowGraphNode>
    readonly edges: ReadonlyArray<FlowGraphEdge>
}

/** The status a dossier stands at: the review's own once it has looked, else the checklist's. */
export type MapStatusOf = (dossier: DossierView) => DossierStatus

/** One document filed under a dossier: the leaf of the map that shows while its dossier is open. */
export interface MapFile {
    readonly id: string
    readonly title: string
}

/** The documents filed under a dossier. */
export type MapFilesOf = (dossier: DossierView) => ReadonlyArray<MapFile>

const FILE_PREFIX = "file:"

/** The id of a document node; the dossier nodes carry the id of their dossier. */
export const mapFileId = (fileId: string): string => `${FILE_PREFIX}${fileId}`

/** The dossier a document leaf belongs to, or undefined when the id names no leaf or its dossier is gone. */
export const dossierOfFile = (
    categories: ReadonlyArray<CategoryView>,
    filesOf: MapFilesOf,
    id: string,
): DossierView | undefined => {
    if (!id.startsWith(FILE_PREFIX)) return undefined
    for (const category of categories) {
        const owner = category.dossiers.find((one) => filesOf(one).some((file) => mapFileId(file.id) === id))
        if (owner !== undefined) return owner
    }
    return undefined
}

/** How a dossier is painted besides its tone, so a status never rests on colour alone. */
export const MAP_STATUS_FILL: Readonly<Record<DossierStatus, FlowGraphFill>> = {
    present: "solid",
    partial: "half",
    drafted: "soft",
    missing: "outline",
    template: "hatched",
}

const isShown = (dossier: DossierView, filter: MapStatusFilter, statusOf: MapStatusOf): boolean =>
    filter === "all" || statusOf(dossier) === filter

/** The part of a category name before the dash ("Members"). */
const categoryShortOf = (category: CategoryView): string => category.label.split(" - ")[0] ?? category.label

/** The number of a category as it is printed on its bubble: "01". */
const categoryMarkOf = (category: CategoryView, index: number): string =>
    String(category.order ?? index + 1).padStart(2, "0")

/** The extension of a document title, upper-cased and held to four letters: the mark of its leaf. */
export const fileMarkOf = (title: string): string => {
    const dot = title.lastIndexOf(".")
    return dot < 0 || dot === title.length - 1 ? "FILE" : title.slice(dot + 1, dot + 5).toUpperCase()
}

/** How many letters of a name fit across a bubble of this width. */
const LETTERS_PER_UNIT = 1 / 8

/** The name inside a bubble when all of it fits; a name that would be cut stays out, and the hover and the side pane carry it. */
const captionOf = (name: string, diameter: number): string | undefined =>
    name.length <= diameter * LETTERS_PER_UNIT ? name : undefined

/** The caption of a bubble as a property, so a bubble whose name does not fit carries none. */
const captionFor = (name: string, diameter: number): { readonly caption?: string } => {
    const caption = captionOf(name, diameter)
    return caption === undefined ? {} : { caption }
}

const ROOT_DIAMETER = 120
const CATEGORY_RANGE = { min: 66, max: 106 } as const
const DOSSIER_RANGE = { min: 30, max: 92 } as const
const FILE_DIAMETER = 28

const ringOf = (category: CategoryView, statusOf: MapStatusOf): ReadonlyArray<FlowGraphRingPart> =>
    DOSSIER_STATUS_ORDER.map((status) => ({
        tone: MAP_STATUS_TONE[status],
        value: category.dossiers.filter((one) => statusOf(one) === status).length,
    })).filter((part) => part.value > 0)

/**
 * The map of the brain as nodes and edges for the orbit layout: the workspace in the centre, its categories on the first ring
 * sized by the documents they hold and ringed by the statuses of their dossiers, the dossiers on the second sized by their
 * documents and painted by status, and the documents of a dossier on the fourth ring while it is open. A filter dims the
 * dossiers at other statuses (with their documents) and the categories that hold none: nothing leaves the map. A category
 * with no dossier at all stays as an unfilled slot.
 */
export const mapGraphOf = (
    categories: ReadonlyArray<CategoryView>,
    words: MapWords,
    filter: MapStatusFilter,
    statusOf: MapStatusOf,
    filesOf: MapFilesOf,
): MapGraph => {
    const dossiers = categories.flatMap((category) => category.dossiers)
    const maxCategory = Math.max(1, ...categories.map((category) => category.documentCount))
    const maxDossier = Math.max(1, ...dossiers.map((dossier) => dossier.documentCount))
    const nodes: FlowGraphNode[] = [
        {
            id: MAP_ROOT_ID,
            label: words.root,
            description: words.rootMeta,
            isRoot: true,
            form: "bubble",
            mark: words.root,
            caption: words.rootMeta,
            diameter: ROOT_DIAMETER,
            tone: "accent",
            fill: "solid",
        },
    ]
    const edges: FlowGraphEdge[] = []
    categories.forEach((category, index) => {
        const categoryId = mapCategoryId(category.id)
        const categoryDiameter = flowGraphDiameter(category.documentCount, maxCategory, CATEGORY_RANGE)
        nodes.push({
            id: categoryId,
            label: categoryShortOf(category),
            description: category.label,
            form: "bubble",
            mark: categoryMarkOf(category, index),
            ...captionFor(categoryShortOf(category), categoryDiameter),
            diameter: categoryDiameter,
            tone: "neutral",
            fill: "soft",
            ring: ringOf(category, statusOf),
            isDimmed: filter !== "all" && !category.dossiers.some((one) => isShown(one, filter, statusOf)),
            isPlaceholder: category.dossiers.length === 0,
        })
        edges.push({ id: `${MAP_ROOT_ID}>${categoryId}`, source: MAP_ROOT_ID, target: categoryId })
        for (const dossier of category.dossiers) {
            const status = statusOf(dossier)
            const isDimmed = !isShown(dossier, filter, statusOf)
            const dossierDiameter = flowGraphDiameter(dossier.documentCount, maxDossier, DOSSIER_RANGE)
            nodes.push({
                id: dossier.id,
                label: dossier.name,
                form: "bubble",
                mark: dossier.ref,
                ...captionFor(dossier.name, dossierDiameter),
                diameter: dossierDiameter,
                tone: MAP_STATUS_TONE[status],
                fill: MAP_STATUS_FILL[status],
                isDimmed,
            })
            edges.push({ id: `${categoryId}>${dossier.id}`, source: categoryId, target: dossier.id })
            for (const file of filesOf(dossier)) {
                const fileId = mapFileId(file.id)
                nodes.push({
                    id: fileId,
                    label: file.title,
                    form: "bubble",
                    mark: fileMarkOf(file.title),
                    diameter: FILE_DIAMETER,
                    tone: "muted",
                    fill: "soft",
                    isDimmed,
                })
                edges.push({ id: `${dossier.id}>${fileId}`, source: dossier.id, target: fileId })
            }
        }
    })
    return { nodes, edges }
}

/** A document as the map reads it: its title and the tags that file it under a dossier (`dossier:<ref>`). */
export interface MapSource {
    readonly id: string
    readonly title: string
    readonly tags: ReadonlyArray<string>
}

/** The documents filed under each dossier by their `dossier:<ref>` tag, in the order the sources came. */
export const mapFilesOf = (sources: ReadonlyArray<MapSource>): MapFilesOf => {
    const byTag = new Map<string, MapFile[]>()
    for (const source of sources) {
        for (const tag of source.tags) {
            const files = byTag.get(tag) ?? []
            files.push({ id: source.id, title: source.title })
            byTag.set(tag, files)
        }
    }
    return (dossier) => byTag.get(dossierTagOf(dossier.ref)) ?? []
}
