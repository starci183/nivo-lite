import { Cluster, EmptyNotice, Fieldset, Grid, SearchField, Section, Stack } from "@starci/grammar/common"
import { ConnectionLibraryTile } from "@/components/composites/ConnectionLibraryTile"
import type { LibraryCard, LibraryCategory } from "@/modules/types"
import { nivoIconSource } from "@/components/leaves/Icon"

/** The library: the search, the group chips and the connector tiles that pass both, under their group headings. */
export interface ConnectionLibraryBaseProps {
    readonly props: {
        readonly text: string
        readonly searchLabel: string
        readonly clearLabel: string
        readonly filterLabel: string
        readonly categories: ReadonlyArray<LibraryCategory>
        readonly emptyMessage: string
        readonly emptyHint: string
        readonly cards: ReadonlyArray<LibraryCard>
        readonly wantLabel: string
        readonly wantedLabel: string
        readonly connectLabel: string
        readonly viewLabel: string
        readonly openPageLabel: string
        /** The chips are drawn blank while the workspace reads are on their way. */
        readonly isLoading: boolean
    }
    readonly on: {
        readonly text: (value: string) => void
        readonly open: (id: string) => void
        readonly want: (id: string) => void
    }
}

/** One section of tiles under its own heading; nothing when it holds none. */
interface TileSectionProps {
    readonly title: string
    readonly cards: ReadonlyArray<LibraryCard>
    readonly base: ConnectionLibraryBaseProps
}

const TileSection = (props: TileSectionProps) => {
    if (props.cards.length === 0) return null
    const labels = {
        want: props.base.props.wantLabel,
        wanted: props.base.props.wantedLabel,
        connect: props.base.props.connectLabel,
        view: props.base.props.viewLabel,
        openPage: props.base.props.openPageLabel,
    }
    return (
        <Section title={props.title} count={props.cards.length}>
            <Grid kind="cards" columns={4}>
                {props.cards.map((card) => (
                    <ConnectionLibraryTile
                        key={card.id}
                        card={card}
                        isLoading={props.base.props.isLoading}
                        labels={labels}
                        onOpen={props.base.on.open}
                        onWant={props.base.on.want}
                    />
                ))}
            </Grid>
        </Section>
    )
}

/**
 * The Connections library: the search (accents ignored; the categories are the sub tabs of the page band), then one section per group (chat channels, money in, Google, APIs and data, sales,
 * accounting), the planned connectors last in their group, each grid of tiles of equal height. A tile shows its status in the shared vocabulary, what it is for
 * and whom it serves, and its one command.
 */
export const ConnectionLibraryBase = (props: ConnectionLibraryBaseProps) => (
    <>
        <Fieldset legend={props.props.filterLabel} isLegendHidden>
            <Cluster gap="row" justify="between" wrap>
                <SearchField
                    id="connector-search"
                    label={props.props.searchLabel}
                    isLabelHidden
                    placeholder={props.props.searchLabel}
                    value={props.props.text}
                    onValueChange={props.on.text}
                    onClear={() => props.on.text("")}
                    clearLabel={props.props.clearLabel}
                />
            </Cluster>
        </Fieldset>
        {props.props.cards.length === 0 ? (
            <EmptyNotice message={props.props.emptyMessage} iconSource={nivoIconSource("search", "leading")} description={props.props.emptyHint} />
        ) : (
            <Stack gap="region">
                {props.props.categories
                    .filter((group) => group.id !== "all")
                    .map((group) => (
                        <TileSection
                            key={group.id}
                            title={group.label}
                            cards={props.props.cards.filter((card) => card.group === group.id)}
                            base={props}
                        />
                    ))}
            </Stack>
        )}
    </>
)
