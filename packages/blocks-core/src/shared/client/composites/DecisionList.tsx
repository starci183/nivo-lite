import type { ReactNode } from "react"
import { waitingChipOf } from "../../rows/count-chip"
import { EmptyNotice, Link, Section, SurfaceCard, type ListRowData } from "@starci/grammar/common"
import type { DecisionQueueView, DecisionRowView } from "../../views/views.types"
import { DecisionRow, type DecisionEdit } from "./DecisionRow"

/** Where a list of waiting rows stands: a card on a card page, or a section in a pane. */
type DecisionListSurface = "card" | "section"

/** The words of a decision list that are not the rows' own. */
interface DecisionListWords {
    readonly label: string
    readonly emptyTitle: string
    readonly emptyBody: string
    readonly seeWhyLabel: string
    readonly moreLabel: string
}

/** The decisions waiting for a person and where they stand. */
interface DecisionListProps {
    readonly surface: DecisionListSurface
    /** Whether the heading is left to the pane around the queue: the label then only names the list. */
    readonly isHeadless: boolean
    /** How large the commands of the rows are. */
    readonly commandSize: "sm" | "md"
    readonly words: DecisionListWords
    readonly queue: DecisionQueueView
    readonly isLoading: boolean
    /** The inline edit form the spec declares; null when it declares none. */
    readonly edit: DecisionEdit | null
    readonly onCommand: (rowId: string, commandId: string) => void
}

/** What leads a row: the logo of its connection, else the initials of the name it gives; nothing when it gives neither. */
const leadingOf = (row: DecisionRowView): Pick<ListRowData, "leading"> => {
    if (row.logo !== undefined && row.logo !== "")
        return { leading: { avatar: { name: row.leading ?? row.title, src: row.logo } } }
    return row.leading === undefined || row.leading === "" ? {} : { leading: { avatar: { name: row.leading } } }
}

/** The collection owns native row metadata; the row owns the decision detail. */
const listRowOf = (row: DecisionRowView, props: DecisionListProps): ListRowData => {
    const [first, second] = row.badges
    return {
        id: row.id,
        title: row.title,
        description: row.description,
        ...leadingOf(row),
        ...(first === undefined ? {} : { badges: second === undefined ? [first] : [first, second] }),
        detail: (
            <DecisionRow
                row={row}
                commandSize={props.commandSize}
                seeWhyLabel={props.words.seeWhyLabel}
                moreLabel={props.words.moreLabel}
                edit={props.edit}
                onCommand={props.onCommand}
            />
        ),
    }
}

/** The decisions waiting for a person, each decided in place; the block draws the empty and collapsed states through SlotView. */
export const DecisionList = (props: DecisionListProps): ReactNode => {
    const rows = props.queue.rows.map((row) => listRowOf(row, props))
    const empty = <EmptyNotice message={props.words.emptyTitle} description={props.words.emptyBody} />
    const more = props.queue.more
    const morePlain =
        more === null ? null : (
            <Link href={more.href} variant="plain">
                {more.label}
            </Link>
        )
    if (props.surface === "card") {
        return (
            <SurfaceCard
                kind="list"
                label={props.words.label}
                {...waitingChipOf(props.queue.count)}
                {...(more === null
                    ? {}
                    : {
                          labelEnd: (
                              <Link variant="head" href={more.href}>
                                  {more.label}
                              </Link>
                          ),
                      })}
                isLoading={props.isLoading}
                items={rows}
                empty={empty}
            />
        )
    }
    return (
        <>
            {props.isHeadless ? (
                <Section
                    kind="list"
                    ariaLabel={props.words.label}
                    isLoading={props.isLoading}
                    items={rows}
                    empty={empty}
                />
            ) : (
                <Section
                    kind="list"
                    title={props.words.label}
                    headingLevel={3}
                    isLoading={props.isLoading}
                    items={rows}
                    empty={empty}
                />
            )}
            {morePlain}
        </>
    )
}
