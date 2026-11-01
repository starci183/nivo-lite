import { Badge, Button, EmptyNotice, ListRow, SurfaceListCard } from "@starci/grammar/common"
import type { BadgeTone } from "@starci/grammar/common"

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
export const placeholderDossierRows = (key: string): ReadonlyArray<DossierRowView> =>
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

/** What the card of dossiers draws: the copy, the rows and whether they are a placeholder. */
interface DossierRowsCardProps {
    /** The category: the heading of the card, outside its shell. */
    readonly label: string
    readonly emptyLabel: string
    readonly rows: ReadonlyArray<DossierRowView>
    readonly footer?: string | undefined
    readonly isSkeleton: boolean
}

/** The dossiers of one category as the rows of one card: the badges say where each stands, the button what to do next. */
export const DossierRowsCard = (props: DossierRowsCardProps) => (
    <SurfaceListCard
        label={props.label}
        isLoading={props.isSkeleton}
        footer={props.footer}
        empty={<EmptyNotice message={props.emptyLabel} />}
    >
        {props.isSkeleton
            ? null
            : props.rows.map((dossier) => (
                  <ListRow
                      key={dossier.id}
                      title={dossier.name}
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
                      actions={
                          dossier.action === null ? undefined : (
                              <Button intent="neutral" href={dossier.action.href}>
                                  {dossier.action.label}
                              </Button>
                          )
                      }
                  />
              ))}
    </SurfaceListCard>
)
