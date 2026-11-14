import type { ReactNode } from "react"
import { EmptyNotice, Link, Section, SurfaceCard, type BadgeData, type ListRowData } from "@starci/grammar/common"
import type { RecordRow } from "../../rows/rows"

/** What the card list takes. */
interface RecordCardListProps {
    /** The heading of the list, which also names it. */
    readonly title: string
    readonly rows: ReadonlyArray<RecordRow>
    /** What the list says when it has no row. */
    readonly empty: string
    readonly isLoading: boolean
    /** Each row starts with the initials of its title. */
    readonly hasAvatar: boolean
    /** The rows sit inside a surface card that already names them: no heading, no card of their own. */
    readonly isHeadless?: boolean
    /** Draw the rows in one surface card, not bare under the heading. */
    readonly isCard: boolean
    /** The command each row offers under its text; null when the viewer may not run it. */
    readonly action: { readonly label: string; readonly press: (id: string) => void } | null
    /** A link under the rows of a card: its words and where it goes; absent draws none. */
    readonly footer?: { readonly label: string; readonly href: string } | undefined
}

/** The marks of a row: its badge in the tone of its value (a result, so no dot), then its first further chip. */
const badgesOf = (row: RecordRow): { readonly badges?: readonly [BadgeData] | readonly [BadgeData, BadgeData] } => {
    const chip = row.chips[0]
    if (row.badge === "") return chip === undefined ? {} : { badges: [{ label: chip, tone: "neutral" }] }
    const status: BadgeData = { label: row.badge, tone: row.tone }
    return chip === undefined ? { badges: [status] } : { badges: [status, { label: chip, tone: "neutral" }] }
}

/** What leads a row: its logo when it has one, else the initials of its title when the list asks for them. */
const leadingOf = (row: RecordRow, hasAvatar: boolean): Pick<ListRowData, "leading"> => {
    if (row.logo !== "") return { leading: { avatar: { name: row.title, src: row.logo } } }
    return hasAvatar ? { leading: { avatar: { name: row.title } } } : {}
}

/** The row the Grammar list draws for one record. */
const rowOf = (row: RecordRow, props: RecordCardListProps): ListRowData => ({
    id: row.id,
    title: row.title,
    ...(row.description === "" ? {} : { description: row.description }),
    ...leadingOf(row, props.hasAvatar),
    ...(row.meta === "" ? {} : { meta: { text: row.meta } }),
    ...badgesOf(row),
    ...(props.action === null
        ? {}
        : { action: { label: props.action.label, press: () => props.action?.press(row.id) } }),
})

/** Bound records as rows under one heading: bare, or in one surface card; an action under the text of each. */
export const RecordCardList = (props: RecordCardListProps): ReactNode => {
    const items = props.rows.map((row) => rowOf(row, props))
    const empty = <EmptyNotice message={props.empty} />
    if (props.isHeadless === true)
        return <Section kind="list" ariaLabel={props.title} isLoading={props.isLoading} items={items} empty={empty} />
    const labelEnd =
        props.footer === undefined
            ? {}
            : {
                  labelEnd: (
                      <Link variant="head" href={props.footer.href}>
                          {props.footer.label}
                      </Link>
                  ),
              }
    return props.isCard ? (
        <SurfaceCard
            kind="list"
            label={props.title}
            headingLevel={3}
            isLoading={props.isLoading}
            items={items}
            empty={empty}
            {...labelEnd}
        />
    ) : (
        <Section
            kind="list"
            title={props.title}
            headingLevel={3}
            isLoading={props.isLoading}
            items={items}
            empty={empty}
        />
    )
}
