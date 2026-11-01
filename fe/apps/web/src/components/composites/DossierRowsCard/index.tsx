import { Badge, EmptyNotice, ListRow, SurfaceListCard, TextAction } from "@starci/grammar/common"
import type { BadgeTone } from "@starci/grammar/common"

/** One badge of a dossier row. */
interface RowBadgeView {
    readonly id: string
    readonly label: string
    readonly tone: BadgeTone
}

/** One dossier of the selected category, already worded. */
export interface DossierRowView {
    readonly id: string
    readonly name: string
    /** Where the name leads: the dossier opened in the detail pane. */
    readonly href: string
    /** The dossier the address has open. */
    readonly isSelected: boolean
    /** The one line under the name: what is missing or held, and how many documents name it. */
    readonly note: string | null
    /** At most two: the status the review stands at, then the active findings or else the documents. */
    readonly badges: ReadonlyArray<RowBadgeView>
}

/** Rows of the same shape as ready ones, drawn as geometry while the dossiers are read. */
const placeholderDossierRows = (key: string): ReadonlyArray<DossierRowView> =>
    [1, 2, 3].map((n) => ({
        id: `${key}-${n}`,
        name: "-",
        href: "#",
        isSelected: false,
        note: "-",
        badges: [
            { id: "status", label: "-", tone: "neutral" },
            { id: "documents", label: "-", tone: "neutral" },
        ],
    }))

/** One category of placeholder rows, the same shape as a ready one. */
export const placeholderDossierCategory = (n: number) => ({
    id: `placeholder-${n}`,
    label: "-",
    meta: "-",
    title: "-",
    dossiers: placeholderDossierRows(`placeholder-${n}`),
})

/** What the card of dossiers draws: the copy, the rows and whether they are a placeholder. */
interface DossierRowsCardProps {
    readonly label: string
    readonly emptyLabel: string
    readonly rows: ReadonlyArray<DossierRowView>
    readonly isSkeleton: boolean
}

/** The dossiers of the selected category as rows of one card: the name opens the dossier, the badges say where it stands. */
export const DossierRowsCard = (props: DossierRowsCardProps) => (
    <SurfaceListCard
        ariaLabel={props.label}
        isLoading={props.isSkeleton}
        empty={<EmptyNotice message={props.emptyLabel} />}
    >
        {props.isSkeleton
            ? null
            : props.rows.map((dossier) => (
                  <ListRow
                      key={dossier.id}
                      title={<TextAction href={dossier.href}>{dossier.name}</TextAction>}
                      description={dossier.note}
                      state={dossier.isSelected ? "informative" : "neutral"}
                      badges={
                          <>
                              {dossier.badges.map((badge) => (
                                  <Badge key={badge.id} tone={badge.tone}>
                                      {badge.label}
                                  </Badge>
                              ))}
                          </>
                      }
                  />
              ))}
    </SurfaceListCard>
)
