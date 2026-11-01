import {
    Alert,
    Badge,
    Button,
    Cluster,
    EmptyNotice,
    Fieldset,
    Grid,
    SearchField,
    SectionHeader,
    Stack,
    SurfaceCard,
    Text,
} from "@starci/grammar/common"
import { ProviderLogo } from "@/components/branches/ProviderLogo"
import type { ConnectorGlyph } from "@/modules/types"
import { connectionLibraryClassNames as classNames } from "./classNames"

/** One category chip: the group and how many connectors it holds. */
export interface LibraryCategory {
    readonly id: string
    readonly label: string
    readonly count: number
}

/** The availability chip beside a tile's name: early access or planned. */
export interface LibraryTag {
    readonly tone: "accent" | "neutral"
    readonly label: string
}

/** What the workspace runs of a connector, at the foot of its tile. */
export interface LibraryStatus {
    readonly tone: "success" | "danger" | "muted"
    readonly label: string
    readonly isDot: boolean
}

/** One connector tile, with its words resolved. */
export interface LibraryCard {
    readonly id: string
    readonly name: string
    readonly blurb: string
    /** What the connector is for and whom it serves, one line. */
    readonly audienceLine: string
    readonly glyph: ConnectorGlyph
    readonly logo?: string
    /** The provider id the guide tour points at; absent for a planned connector. */
    readonly guide?: string
    readonly tag: LibraryTag | null
    readonly status: LibraryStatus
    /** How many connections of it the workspace runs: with some, the tile offers "Add". */
    readonly connected: number
    /** One of the connectors the workspace can use today: it stands in the first section. */
    readonly isCurrent: boolean
    /** A planned connector: no page, only the "I want it" command. */
    readonly isSoon: boolean
    /** A planned connector: the state of its "I need this" command. */
    readonly want: { readonly isPending: boolean; readonly isDone: boolean; readonly note?: string }
}

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
        readonly currentLabel: string
        readonly othersLabel: string
        /** The chips are drawn blank while the workspace reads are on their way. */
        readonly isSkeleton: boolean
    }
    readonly on: {
        readonly text: (value: string) => void
        readonly category: (id: string) => void
        readonly open: (id: string) => void
        readonly want: (id: string) => void
    }
}

const wantOf = (props: ConnectionLibraryBaseProps, card: LibraryCard) => (
    <>
        <Button
            intent="neutral"
            size="sm"
            isDisabled={card.want.isDone}
            isPending={card.want.isPending}
            onPress={() => props.on.want(card.id)}
        >
            {card.want.isDone ? props.props.wantedLabel : props.props.wantLabel}
        </Button>
        {card.want.note === undefined ? null : <Alert tone="informative" title={card.want.note} />}
    </>
)

/** The command at the foot of a tile: Connect (emphasised for the four current providers), Add once connected, or "I need this". */
const commandOf = (props: ConnectionLibraryBaseProps, card: LibraryCard) =>
    card.isSoon ? (
        wantOf(props, card)
    ) : (
        <Button
            intent={card.connected === 0 && card.isCurrent ? "alternative" : "neutral"}
            size="sm"
            onPress={() => props.on.open(card.id)}
        >
            {card.connected === 0 ? props.props.connectLabel : props.props.addLabel}
        </Button>
    )

const tileOf = (props: ConnectionLibraryBaseProps, card: LibraryCard) => (
    <div key={card.id} {...(card.guide === undefined ? {} : { "data-guide": `connections.${card.guide}` })}>
        <SurfaceCard ariaLabel={card.name} height="fill" {...(card.isSoon ? { state: "unavailable" as const } : {})}>
            <div className={classNames.card}>
                <Cluster gap="row" wrap={false}>
                    <ProviderLogo
                        size="lg"
                        glyph={card.glyph}
                        {...(card.logo === undefined ? {} : { src: card.logo })}
                    />
                    <Stack gap="identity">
                        <Cluster gap="inline">
                            <Text weight="semibold">{card.name}</Text>
                            {card.tag === null ? null : (
                                <Badge tone={card.tag.tone} isSkeleton={props.props.isSkeleton}>
                                    {card.tag.label}
                                </Badge>
                            )}
                        </Cluster>
                        <Text size="xs" tone="muted">
                            {card.audienceLine}
                        </Text>
                    </Stack>
                </Cluster>
                <Text size="sm" tone="muted" overflow="clamp-2">
                    {card.blurb}
                </Text>
                <div className={classNames.cardFoot}>
                    <Cluster gap="row" justify={card.isSoon ? "end" : "between"}>
                        {card.isSoon ? null : (
                            <Badge
                                tone={card.status.tone}
                                isDot={card.status.isDot}
                                isSkeleton={props.props.isSkeleton}
                            >
                                {card.status.label}
                            </Badge>
                        )}
                        {commandOf(props, card)}
                    </Cluster>
                </div>
            </div>
        </SurfaceCard>
    </div>
)

/** One category button of the filter row. */
interface FilterOption {
    readonly id: string
    readonly label: string
    readonly count: number
}

/**
 * The filter row: one `sm` button per option, the chosen one pressed, on one row. A thin local stand-in for the Grammar
 * `FilterButtonGroup` (not pinned yet): swapping it in is this one component, which will also show the "+n" overflow.
 */
interface FilterButtonGroupProps {
    readonly options: ReadonlyArray<FilterOption>
    readonly value: string
    readonly onChange: (id: string) => void
}

const FilterButtonGroup = (props: FilterButtonGroupProps) => (
    <Cluster gap="inline">
        {props.options.map((option) => (
            <Button
                key={option.id}
                size="sm"
                intent={option.id === props.value ? "alternative" : "neutral"}
                aria-pressed={option.id === props.value}
                onPress={() => props.onChange(option.id)}
            >
                {`${option.label} ${option.count}`}
            </Button>
        ))}
    </Cluster>
)

/** One section of tiles under its own heading; nothing when it holds none. */
interface TileSectionProps {
    readonly title: string
    readonly cards: ReadonlyArray<LibraryCard>
    readonly base: ConnectionLibraryBaseProps
}

const TileSection = (props: TileSectionProps) =>
    props.cards.length === 0 ? null : (
        <Stack gap="section">
            <SectionHeader level={2} title={props.title} count={props.cards.length} />
            <Grid kind="cards" columns={3}>
                {props.cards.map((card) => tileOf(props.base, card))}
            </Grid>
        </Stack>
    )

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
            <FilterButtonGroup
                options={props.props.categories}
                value={props.props.category}
                onChange={props.on.category}
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
