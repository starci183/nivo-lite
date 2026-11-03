import type { ReactElement } from "react"
import { EmptyNotice, SurfaceCard, type BadgeTone, type ListRowData } from "@starci/grammar/common"

/** One badge of a dossier row. */
interface RowBadgeView {
    readonly id: string
    readonly label: string
    readonly tone: BadgeTone
}

/** What a dossier row leads to: its findings, or the upload that completes it. */
interface RowActionView {
    readonly label: string
    readonly href: string
}

/** One dossier of a category, already worded. */
export interface DossierRowView {
    readonly id: string
    readonly name: string
    /** The dossier the address has open. */
    readonly isSelected: boolean
    /** The one line under the name: what is missing or held, and how many documents name it. */
    readonly note: string | null
    /** At most two: the status the review stands at, then the active findings or else the documents. */
    readonly badges: ReadonlyArray<RowBadgeView>
    /** The one thing to do next; null when the dossier needs nothing. */
    readonly action: RowActionView | null
}

/** Rows of the same shape as ready ones, drawn as geometry while the dossiers are read. */
const placeholderDossierRows = (key: string): ReadonlyArray<DossierRowView> =>
    [1, 2, 3].map((n) => ({
        id: `${key}-${n}`,
        name: "-",
        isSelected: false,
        note: "-",
        badges: [
            { id: "status", label: "-", tone: "neutral" },
            { id: "documents", label: "-", tone: "neutral" },
        ],
        action: null,
    }))

/** One category of dossiers as the card draws it. */
export interface DossierCategoryView {
    readonly id: string
    readonly label: string
    readonly meta: string
    readonly title: string
    readonly dossiers: ReadonlyArray<DossierRowView>
}

/** One category of placeholder rows, the same shape as a ready one. */
export const placeholderDossierCategory = (n: number): DossierCategoryView => ({
    id: `placeholder-${n}`,
    label: "-",
    meta: "-",
    title: "-",
    dossiers: placeholderDossierRows(`placeholder-${n}`),
})

/** What the card of dossiers draws: the copy, the rows and whether they are a placeholder. */
interface DossierRowsCardProps {
    /** The category: the heading of the card, outside its shell. */
    readonly label: string
    readonly emptyLabel: string
    readonly rows: ReadonlyArray<DossierRowView>
    readonly footer?: string | undefined
    readonly isLoading: boolean
}

/** The dossiers of one category as the rows of one card: the badges say where each stands, the button what to do next. */
export const DossierRowsCard = (props: DossierRowsCardProps): ReactElement => (
    <SurfaceCard
        kind="list"
        label={props.label}
        isLoading={props.isLoading === true}
        footer={props.footer}
        empty={<EmptyNotice message={props.emptyLabel} />}
        items={props.rows.map(dossierItemOf)}
    />
)

/** The category's row contract carries its two badges and its one destination as data. */
const dossierItemOf = (dossier: DossierRowView): ListRowData => {
    const [status, count] = dossier.badges
    let badges: ListRowData["badges"]
    if (status !== undefined) badges = count === undefined ? [status] : [status, count]
    return {
        id: dossier.id,
        title: dossier.name,
        ...(dossier.note == null ? {} : { description: dossier.note }),
        state: dossier.isSelected ? "informative" : "neutral",
        ...(badges === undefined ? {} : { badges }),
        ...(dossier.action === null ? {} : { action: { label: dossier.action.label, href: dossier.action.href } }),
    }
}
