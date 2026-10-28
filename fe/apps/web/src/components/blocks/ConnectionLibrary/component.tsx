import {
    Alert,
    Badge,
    Button,
    EmptyNotice,
    ListBox,
    Region,
    SearchField,
    SectionHeader,
    Select,
    SurfaceCard,
    Text,
} from "@starci/grammar/common"
import { ProviderLogo } from "@/components/branches/ProviderLogo"
import type { ConnectorGlyph } from "@/modules/types"
import { connectionLibraryClassNames as classNames } from "./classNames"

/** One option of a filter or of the sort. */
export interface LibraryOption {
    readonly id: string
    readonly label: string
}

/** One row of the category rail: the group and how many connectors it holds. */
export interface LibraryCategory extends LibraryOption {
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
    /** A planned connector: no page, only the "I want it" command. */
    readonly isSoon: boolean
    /** A planned connector: the state of its "I need this" command. */
    readonly want: { readonly isPending: boolean; readonly isDone: boolean; readonly note?: string }
    /** The provider page of the workspace's connection, when there is one to open. */
    readonly href?: string
    /** Accessible name of the whole-tile command. */
    readonly openLabel: string
}

/** One category heading with its tiles. */
export interface LibraryGroup {
    readonly id: string
    readonly title: string
    readonly cards: ReadonlyArray<LibraryCard>
}

/** The library: category rail, search, agent filter, sort and the grouped tiles. */
export interface ConnectionLibraryBaseProps {
    readonly props: {
        readonly text: string
        readonly searchLabel: string
        readonly clearLabel: string
        readonly sort: string
        readonly sortLabel: string
        readonly sortOptions: ReadonlyArray<LibraryOption>
        readonly categoryLabel: string
        readonly category: string
        readonly categories: ReadonlyArray<LibraryCategory>
        readonly audienceLabel: string
        readonly audience: string
        readonly audiences: ReadonlyArray<LibraryOption>
        readonly emptyMessage: string
        readonly emptyHint: string
        readonly groups: ReadonlyArray<LibraryGroup>
        readonly wantLabel: string
        readonly wantedLabel: string
        /** The chips are drawn blank while the workspace reads are on their way. */
        readonly isSkeleton: boolean
    }
    readonly on: {
        readonly text: (value: string) => void
        readonly sort: (value: string) => void
        readonly category: (id: string) => void
        readonly audience: (id: string) => void
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
                headingLevel={3}
                {...(wholeAction === undefined ? {} : { wholeAction })}
                {...(card.isSoon ? { state: "unavailable" as const } : {})}
            >
                <div className={classNames.card}>
                    <div className={classNames.cardHead}>
                        <ProviderLogo glyph={card.glyph} {...(card.logo === undefined ? {} : { src: card.logo })} />
                        <div className={classNames.cardName} />
                        {card.badge === null ? null : (
                            <Badge tone={card.badge.tone} isDot={card.badge.isDot} isSkeleton={props.props.isSkeleton}>
                                {card.badge.label}
                            </Badge>
                        )}
                    </div>
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

const groupsOf = (props: ConnectionLibraryBaseProps) =>
    props.props.groups.map((group) => (
        <Region key={group.id} labelledBy={`lib-${group.id}`} className={classNames.group}>
            <SectionHeader id={`lib-${group.id}`} level={2} title={group.title} count={group.cards.length} />
            <div className={classNames.grid}>{group.cards.map((card) => tileOf(props, card))}</div>
        </Region>
    ))

/**
 * The Connections library: a rail of categories with counts beside the connectors grouped by category, searchable (accents ignored),
 * filtered by the agent each serves, sorted by popularity or name. A tile shows its status, what it is for and who it serves.
 */
export const ConnectionLibraryBase = (props: ConnectionLibraryBaseProps) => (
    <div className={classNames.layout}>
        <div className={classNames.rail}>
            <ListBox
                label={props.props.categoryLabel}
                selectionMode="single"
                selectedIds={[props.props.category]}
                onSelectionChange={(ids) => props.on.category(ids[0] ?? "all")}
                items={props.props.categories.map((category) => ({
                    id: category.id,
                    label: category.label,
                    trailing: category.count,
                }))}
            />
        </div>
        <div className={classNames.content}>
            <div className={classNames.toolbar}>
                <div className={classNames.search}>
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
                </div>
                <div className={classNames.select}>
                    <Select
                        label={props.props.audienceLabel}
                        options={[...props.props.audiences]}
                        value={props.props.audience}
                        onValueChange={(value) => props.on.audience(value ?? "all")}
                    />
                </div>
                <div className={classNames.select}>
                    <Select
                        label={props.props.sortLabel}
                        isLabelHidden
                        options={[...props.props.sortOptions]}
                        value={props.props.sort}
                        onValueChange={(value) => props.on.sort(value ?? "popular")}
                    />
                </div>
            </div>
            {props.props.groups.length === 0 ? (
                <EmptyNotice message={props.props.emptyMessage} description={props.props.emptyHint} />
            ) : (
                groupsOf(props)
            )}
        </div>
    </div>
)
