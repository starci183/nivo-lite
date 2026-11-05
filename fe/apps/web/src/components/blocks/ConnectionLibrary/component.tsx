import { EmptyNotice, Fieldset, Grid, SearchField, Section, Stack, Tabs } from "@starci/grammar/common"
import { ConnectionLibraryTile } from "@/components/composites/ConnectionLibraryTile"
import type { LibraryCard, LibraryCategory } from "@/modules/types"

/** The library: the search, the category chips and the connector tiles that pass both. */
export interface ConnectionLibraryBaseProps {
    readonly props: {
        readonly text: string
        readonly searchLabel: string
        readonly clearLabel: string
        readonly filterLabel: string
        readonly category: string
        readonly categories: ReadonlyArray<LibraryCategory>
        readonly emptyMessage: string
        readonly emptyHint: string
        readonly cards: ReadonlyArray<LibraryCard>
        readonly wantLabel: string
        readonly wantedLabel: string
        readonly connectLabel: string
        readonly addLabel: string
        readonly viewLabel: string
        readonly openPageLabel: string
        readonly currentLabel: string
        readonly othersLabel: string
        /** The chips are drawn blank while the workspace reads are on their way. */
        readonly isLoading: boolean
    }
    readonly on: {
        readonly text: (value: string) => void
        readonly category: (id: string) => void
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
        add: props.base.props.addLabel,
        view: props.base.props.viewLabel,
        openPage: props.base.props.openPageLabel,
    }
    return (
        <Section title={props.title} count={props.cards.length}>
            <Grid kind="cards" columns={3}>
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
 * The Connections library: the search (accents ignored) and the category chips with their counts, which wrap onto the next line on a
 * narrow screen (chip.choose.role:filter), then the connectors the workspace can use today in one grid and the other connectors under their own heading, each grid of tiles of equal height. A tile shows its status, what it is for and whom it
 * serves.
 */
export const ConnectionLibraryBase = (props: ConnectionLibraryBaseProps) => (
    <>
        <Fieldset legend={props.props.filterLabel} isLegendHidden>
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
            <Tabs
                label={props.props.filterLabel}
                selectedKey={props.props.category}
                items={props.props.categories.map((category) => ({
                    id: category.id,
                    label: `${category.label} ${category.count}`,
                }))}
                onSelect={props.on.category}
                labelVisibility="always"
            />
        </Fieldset>
        {props.props.cards.length === 0 ? (
            <EmptyNotice message={props.props.emptyMessage} description={props.props.emptyHint} />
        ) : (
            <Stack gap="region">
                <TileSection
                    title={props.props.currentLabel}
                    cards={props.props.cards.filter((card) => card.isCurrent)}
                    base={props}
                />
                <TileSection
                    title={props.props.othersLabel}
                    cards={props.props.cards.filter((card) => !card.isCurrent)}
                    base={props}
                />
            </Stack>
        )}
    </>
)
