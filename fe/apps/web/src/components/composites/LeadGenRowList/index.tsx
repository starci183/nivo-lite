import { Badge, EmptyNotice, ListRow, SurfaceListCard, Text, TextAction } from "@starci/grammar/common"
import type { BadgeTone } from "@starci/grammar/common"

/** A small label beside a row. */
interface LeadGenRowBadge {
    readonly label: string
    readonly tone: BadgeTone
    readonly isDot?: boolean
}

/** One row, every word already resolved; the title is a link when the row has a destination. */
interface LeadGenRow {
    readonly id: string
    readonly title: string
    readonly href: string | null
    readonly description: string
    readonly badges: ReadonlyArray<LeadGenRowBadge>
}

/** The words and rows of a Lead Gen list (prospects, sources or hand-offs). */
export interface LeadGenRowListProps {
    readonly label: string
    readonly emptyTitle: string
    readonly emptyBody: string
    readonly rows: ReadonlyArray<LeadGenRow>
    /** A muted line under the list, such as how many more rows there are. */
    readonly hiddenText: string | null
}

/** A list of Lead Gen rows with their badges; the name opens the lead when the row has a destination. */
export const LeadGenRowList = (props: LeadGenRowListProps) => (
    <>
        <SurfaceListCard
            ariaLabel={props.label}
            empty={<EmptyNotice message={props.emptyTitle} description={props.emptyBody} />}
        >
            {props.rows.map((row) => (
                <ListRow
                    key={row.id}
                    title={row.href === null ? row.title : <TextAction href={row.href}>{row.title}</TextAction>}
                    description={row.description}
                    badges={row.badges.map((badge) => (
                        <Badge key={badge.label} tone={badge.tone} isDot={badge.isDot}>
                            {badge.label}
                        </Badge>
                    ))}
                />
            ))}
        </SurfaceListCard>
        {props.hiddenText === null ? null : (
            <Text size="sm" tone="muted">
                {props.hiddenText}
            </Text>
        )}
    </>
)
