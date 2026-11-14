import { EmptyNotice, Grid, Stack, SurfaceCard, type ListRowData } from "@starci/grammar/common"
import { nivoIconSource, type IconName } from "@/components/leaves/Icon"

/** One row of a card of the staff home: what it says, how it is marked, and where it opens. */
export interface StaffHomeRow {
    readonly id: string
    readonly title: string
    readonly description?: string
    /** The glyph at the start of the row. */
    readonly icon: IconName
    /** A short mark after the words (an unread count, a channel). */
    readonly badge?: { readonly label: string; readonly tone: "accent" | "muted" }
    /** One short fact at the end (a time). */
    readonly meta?: string
    /** The address the row opens. */
    readonly href: string
}

/** One list card of the page: its title, its rows, the words of its empty state and the place that holds the rest. */
export interface StaffHomeList {
    readonly title: string
    /** A short count or fact after the title, or null. */
    readonly fact: string | null
    readonly rows: ReadonlyArray<StaffHomeRow>
    readonly isLoading: boolean
    readonly emptyTitle: string
    readonly emptyBody: string
    readonly emptyIcon: IconName
    /** The command that opens the whole list, or null when the card has none. */
    readonly more: { readonly label: string; readonly href: string } | null
}

/** One key figure. */
export interface StaffHomeFigure {
    readonly id: string
    readonly term: string
    readonly value: number
}

/** What the regions of the staff home are told. */
interface StaffHomeRegionsProps {
    readonly props: {
        readonly figuresLabel: string
        readonly figures: ReadonlyArray<StaffHomeFigure>
        readonly isFiguresLoading: boolean
        readonly work: StaffHomeList
        readonly chats: StaffHomeList
        readonly shortcuts: StaffHomeList
    }
    readonly on: {
        /** Opens an address of the workspace. */
        readonly open: (href: string) => void
    }
}

/** One row as a list row: the glyph at its start, the mark and the fact after its words; the whole row opens it (Grammar draws the chevron). */
const rowOf = (row: StaffHomeRow, open: (href: string) => void): ListRowData => ({
    id: row.id,
    title: row.title,
    ...(row.description === undefined ? {} : { description: row.description }),
    leading: { icon: nivoIconSource(row.icon, "leading"), size: "sm" as const },
    ...(row.badge === undefined ? {} : { badges: [{ label: row.badge.label, tone: row.badge.tone }] as const }),
    ...(row.meta === undefined ? {} : { meta: { text: row.meta } }),
    onPress: () => open(row.href),
})

/** What a list card is told: the list and the command that opens an address. */
interface ListCardProps {
    readonly list: StaffHomeList
    readonly open: (href: string) => void
}

/** One bounded list on the page canvas: a card with its rows, an empty notice with a mark, and the way to the rest. */
const ListCard = (props: ListCardProps) => {
    const { list, open } = props
    const more = list.more
    return (
        <SurfaceCard
            kind="list"
            label={list.title}
            headingLevel={2}
            {...(list.fact === null ? {} : { fact: list.fact })}
            isLoading={list.isLoading}
            items={list.rows.map((row) => rowOf(row, open))}
            empty={
                <EmptyNotice
                    message={list.emptyTitle}
                    description={list.emptyBody}
                    iconSource={nivoIconSource(list.emptyIcon, "heading")}
                />
            }
            footers={more === null ? [] : [{ kind: "more", label: more.label, press: () => open(more.href) }]}
        />
    )
}

/** The regions of the home of a member of staff: their key figures, then the work beside the recent chats, then the pages they can open. */
export const StaffHomeRegions = (props: StaffHomeRegionsProps) => {
    const { on } = props
    const page = props.props
    return (
        <Stack gap="section">
            <SurfaceCard
                kind="figures"
                ariaLabel={page.figuresLabel}
                isLoading={page.isFiguresLoading}
                items={page.figures.map((figure) => ({ id: figure.id, term: figure.term, value: figure.value }))}
            />
            <Grid kind="cards" columns={2}>
                <ListCard list={page.work} open={on.open} />
                <ListCard list={page.chats} open={on.open} />
            </Grid>
            <ListCard list={page.shortcuts} open={on.open} />
        </Stack>
    )
}
