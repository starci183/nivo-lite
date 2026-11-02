import { type ListRowData, EmptyNotice, Stack, SurfaceCard, Text, type BadgeTone } from "@starci/grammar/common"

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
interface LeadGenRowListProps {
    readonly label: string
    readonly emptyTitle: string
    readonly emptyBody: string
    readonly rows: ReadonlyArray<LeadGenRow>
    /** A muted line under the list, such as how many more rows there are. */
    readonly hiddenText: string | null
    /** The rows are not read yet: the card draws its skeleton rows. */
    readonly isSkeleton?: boolean
}

/** A list of Lead Gen rows with their badges; the name opens the lead when the row has a destination. */
export const LeadGenRowList = (props: LeadGenRowListProps) => (
    <>
        <SurfaceCard
            kind="list"
            ariaLabel={props.label}
            isLoading={props.isSkeleton === true}
            empty={<EmptyNotice message={props.emptyTitle} description={props.emptyBody} />}
            items={props.rows.map((row) => leadGenItemOf(row, props.isSkeleton === true))}
        />
        {props.hiddenText === null ? null : (
            <Text size="sm" tone="muted">
                {props.hiddenText}
            </Text>
        )}
    </>
)

/** Carries a native title destination and the row's bounded status badges. */
const leadGenItemOf = (row: LeadGenRow, isLoading: boolean): ListRowData => {
    const [status, exception, ...facts] = row.badges
    let badges: ListRowData["badges"]
    if (status !== undefined) badges = exception === undefined ? [status] : [status, exception]
    return {
        id: row.id,
        title: row.title,
        description: row.description,
        ...(row.href === null ? {} : { href: row.href }),
        ...(badges === undefined ? {} : { badges }),
        detail:
            facts.length === 0 ? undefined : (
                <Stack gap="identity">
                    {facts.map((fact) => (
                        <Text key={fact.label} size="xs" tone="muted" isLoading={isLoading}>
                            {fact.label}
                        </Text>
                    ))}
                </Stack>
            ),
    }
}
