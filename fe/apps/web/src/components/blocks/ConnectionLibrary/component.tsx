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
    TagGroup,
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

/** The status chip of a tile. */
export interface LibraryBadge {
    readonly tone: "success" | "danger" | "neutral"
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
    readonly badge: LibraryBadge | null
    /** One of the connectors the workspace can use today: it stands in the first section. */
    readonly isCurrent: boolean
    /** A planned connector: no page, only the "I want it" command. */
    readonly isSoon: boolean
    /** A planned connector: the state of its "I need this" command. */
    readonly want: { readonly isPending: boolean; readonly isDone: boolean; readonly note?: string }
    /** The provider page of the workspace's connection, when there is one to open. */
    readonly href?: string
    /** Accessible name of the whole-tile command. */
    readonly openLabel: string
}

/** The library: the search, the category chips and the connector tiles that pass both. */
export interface ConnectionLibraryBaseProps {
    readonly props: {
        readonly text: string
        readonly searchLabel: string
        readonly clearLabel: string
        readonly filterLabel: string
        readonly categoryLabel: string
        readonly category: string
        readonly categories: ReadonlyArray<LibraryCategory>
        readonly emptyMessage: string
        readonly emptyHint: string
        readonly cards: ReadonlyArray<LibraryCard>
        readonly wantLabel: string
        readonly wantedLabel: string
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

const wholeActionOf = (props: ConnectionLibraryBaseProps, card: LibraryCard) => {
    if (card.isSoon) return undefined
    if (card.href !== undefined) return { kind: "link", href: card.href, label: card.openLabel } as const
    return { kind: "button", press: () => props.on.open(card.id), label: card.openLabel } as const
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

const tileOf = (props: ConnectionLibraryBaseProps, card: LibraryCard) => {
    const wholeAction = wholeActionOf(props, card)
    return (
        <div key={card.id} {...(card.guide === undefined ? {} : { "data-guide": `connections.${card.guide}` })}>
            <SurfaceCard
                label={card.name}
                headingLevel={2}
                height="fill"
                {...(wholeAction === undefined ? {} : { wholeAction })}
                {...(card.isSoon ? { state: "unavailable" as const } : {})}
            >
                <div className={classNames.card}>
                    <Cluster gap="row" wrap={false} justify="between">
                        <ProviderLogo glyph={card.glyph} {...(card.logo === undefined ? {} : { src: card.logo })} />
                        {card.badge === null ? null : (
                            <Badge tone={card.badge.tone} isDot={card.badge.isDot} isSkeleton={props.props.isSkeleton}>
                                {card.badge.label}
                            </Badge>
                        )}
                    </Cluster>
                    {card.isSoon ? null : (
                        <Text size="sm" tone="muted" overflow="clamp-2">
                            {card.blurb}
                        </Text>
                    )}
                    <div className={classNames.cardFoot}>
                        {card.isSoon ? (
                            wantOf(props, card)
                        ) : (
                            <Text size="xs" tone="muted">
                                {card.audienceLine}
                            </Text>
                        )}
                    </div>
                </div>
            </SurfaceCard>
        </div>
    )
}

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
            <TagGroup
                label={props.props.categoryLabel}
                selectionMode="single"
                selectedIds={[props.props.category]}
                onSelectionChange={(ids) => props.on.category(ids[0] ?? "all")}
                items={props.props.categories.map((category) => ({
                    id: category.id,
                    label: `${category.label} ${category.count}`,
                }))}
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
