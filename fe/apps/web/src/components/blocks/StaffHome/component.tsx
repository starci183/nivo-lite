import { EmptyNotice, Grid, Page, Stack, SurfaceCard } from "@starci/grammar/common"
import type { ListRowData } from "@starci/grammar/common"
import { nivoIconSource } from "@/components/leaves/Icon"
import type { StaffHomeBaseProps, StaffHomeList, StaffHomeRow } from "./types"

export type { StaffHomeBaseProps } from "./types"

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

/** One bounded list on the page canvas: a card with its rows, an empty notice with a mark, and the way to the rest. */
const ListCard = (props: { readonly list: StaffHomeList; readonly open: (href: string) => void }) => {
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

/**
 * Draws the home of a member of staff: the key figures of their day, then the work that waits for them beside their recent chats,
 * today's customers beside the pages they can open. Owners and managers have the business dashboard at the same address.
 */
export const StaffHomeBase = (props: StaffHomeBaseProps) => {
    const { on } = props
    const page = props.props
    return (
        <Page measure="product" header={{ breadcrumbs: "root", title: page.title, description: page.description }}>
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
                <Grid kind="cards" columns={2}>
                    <ListCard list={page.leads} open={on.open} />
                    <ListCard list={page.shortcuts} open={on.open} />
                </Grid>
            </Stack>
        </Page>
    )
}
