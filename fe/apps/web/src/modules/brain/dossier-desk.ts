import { filterOfStatus } from "./findings"
import type { DossierFindingsPane } from "./dossier-findings-pane"
import { dossierTagOf, reviewedStatusOf } from "./finding-view"
import type { FindingFilter } from "./findings"
import type { FindingActionView } from "./finding-row"
import type { FindingView } from "./finding-view"
import type { CategoryView, DossierView } from "./dossiers"
import type { DossierRowView, DossierSectionView } from "./dossier-desk-view"

/** The commands a finding card draws in the open, in the order they are preferred: bringing the document, then confirming and giving it away. */
const PREFERRED_ACTIONS: ReadonlyArray<string> = ["upload", "askDraft", "viewDraft", "confirm", "assign", "reopen"]

/** How many commands a finding card draws in the open; the others sit in its menu. */
const OPEN_ACTIONS = 2

/** The commands of a finding card split into the two it draws and the ones its menu holds. */
export interface SplitActions {
    readonly open: ReadonlyArray<FindingActionView>
    readonly menu: ReadonlyArray<FindingActionView>
}

/** Splits the commands of a finding: the two most wanted stay in view (the document first), the rest go to the menu. */
export const splitActionsOf = (actions: ReadonlyArray<FindingActionView>): SplitActions => {
    const ranked = [...actions].sort((left, right) => {
        const leftRank = PREFERRED_ACTIONS.indexOf(left.id)
        const rightRank = PREFERRED_ACTIONS.indexOf(right.id)
        return (
            (leftRank < 0 ? PREFERRED_ACTIONS.length : leftRank) -
            (rightRank < 0 ? PREFERRED_ACTIONS.length : rightRank)
        )
    })
    const open = ranked.filter((action) => PREFERRED_ACTIONS.includes(action.id)).slice(0, OPEN_ACTIONS)
    return { open, menu: actions.filter((action) => !open.includes(action)) }
}

/** How many findings stand at each filter; undefined while only the first page is read, since a count of the page would be wrong. */
export const findingCountsOf = (
    findings: ReadonlyArray<FindingView>,
    isComplete: boolean,
): Readonly<Record<FindingFilter, number | undefined>> => {
    const count = (filter: FindingFilter): number | undefined =>
        isComplete ? findings.filter((one) => filterOfStatus(one.status) === filter).length : undefined
    return { open: count("open"), confirmed: count("confirmed"), closed: count("closed") }
}

/** The words a list of dossiers is drawn with. */
export interface DossierSectionWords {
    /** The caption of a category: its number and its name. */
    readonly captionOf: (category: CategoryView) => string
    readonly rowOf: (category: CategoryView, dossier: DossierView) => DossierRowView
}

/** Whether a dossier answers a search: its name, or its number on the checklist. */
const matches = (dossier: DossierView, needle: string): boolean =>
    needle === "" || `${dossier.ref} ${dossier.name}`.toLowerCase().includes(needle)

/** The categories of the list with the dossiers that answer the search; a category with none is left out. */
export const dossierSectionsOf = (
    categories: ReadonlyArray<CategoryView>,
    query: string,
    words: DossierSectionWords,
): ReadonlyArray<DossierSectionView> => {
    const needle = query.trim().toLowerCase()
    return categories
        .map((category) => ({
            id: category.id,
            title: words.captionOf(category),
            rows: category.dossiers.filter((one) => matches(one, needle)).map((one) => words.rowOf(category, one)),
        }))
        .filter((section) => section.rows.length > 0)
}

/** A document as the desk reads it: what names it, what it is and how many passages it was cut into. */
export interface DossierSource {
    readonly id: string
    readonly title: string
    readonly kind: string
    readonly chunkCount: number
    readonly tags: ReadonlyArray<string>
}

/** The documents filed under a dossier by its `dossier:<ref>` tag, in the order the sources came. */
export const dossierDocumentsOf = (sources: ReadonlyArray<DossierSource>, ref: string): ReadonlyArray<DossierSource> =>
    sources.filter((source) => source.tags.includes(dossierTagOf(ref)))

/** Where the review leaves a dossier. */
export type Standing = ReturnType<typeof reviewedStatusOf>

/** Where the open dossier stands in the checklist: its category, the dossier and the status the review settled on. */
export interface Opened {
    readonly category: CategoryView
    readonly dossier: DossierView
    readonly standing: Standing
}

/** The dossier an id names, with its category; null when the id names none. */
export const findOpened = (
    categories: ReadonlyArray<CategoryView>,
    id: string | null,
    standingOf: (dossier: DossierView) => Standing,
): Opened | null => {
    const category = categories.find((one) => one.dossiers.some((dossier) => dossier.id === id))
    const dossier = category?.dossiers.find((one) => one.id === id)
    return category === undefined || dossier === undefined ? null : { category, dossier, standing: standingOf(dossier) }
}

/**
 * The findings the body of the open dossier draws: while the desk's first reads are in, the pane as geometry (its words stay
 * real, its counts and rows wait); otherwise the pane of the open dossier, or null while none is open.
 */
export const waitingFindingsOf = (isWaiting: boolean, pane: DossierFindingsPane): DossierFindingsPane | null => {
    if (isWaiting) {
        return {
            ...pane,
            isVisible: true,
            filters: pane.filters.map((one) => ({ ...one, count: undefined })),
            slot: { isLoading: true },
        }
    }
    return pane.isVisible ? pane : null
}
