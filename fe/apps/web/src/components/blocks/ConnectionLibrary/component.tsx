import { Badge, Button, EmptyNotice, SearchField, Select, SurfaceCard, TagGroup, Text } from "@starci/grammar/common"
import { ProviderLogo } from "@/components/branches/ProviderLogo"
import type { ConnectorGlyph } from "@/modules/types"
import { connectionLibraryClassNames as classNames } from "./classNames"

/** One option of a filter or of the sort. */
export interface LibraryOption {
    readonly id: string
    readonly label: string
}

/** The status chip of a card. */
export interface LibraryBadge {
    readonly tone: "success" | "neutral"
    readonly label: string
    readonly isDot: boolean
}

/** One connector card, with its words resolved. */
export interface LibraryCard {
    readonly id: string
    readonly name: string
    readonly blurb: string
    readonly categoryLabel: string
    readonly glyph: ConnectorGlyph
    readonly logo?: string
    /** The provider id the guide tour points at; absent for a planned connector. */
    readonly guide?: string
    readonly badge: LibraryBadge | null
    readonly actionLabel: string
}

/** The library: search, sort, two filters and the cards. */
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
        readonly categories: ReadonlyArray<LibraryOption>
        readonly audienceLabel: string
        readonly audience: string
        readonly audiences: ReadonlyArray<LibraryOption>
        readonly emptyMessage: string
        readonly emptyHint: string
        readonly cards: ReadonlyArray<LibraryCard>
        /** STATE-8: the catalog is known, the workspace counts are not - each badge and action is a skeleton. */
        readonly isLoading: boolean
    }
    readonly on: {
        readonly text: (value: string) => void
        readonly sort: (value: string) => void
        readonly category: (id: string) => void
        readonly audience: (id: string) => void
        readonly open: (id: string) => void
    }
}

/**
 * The Connections library: every connector of the catalog, searchable (accents ignored), filtered by category and by the agent it
 * serves, sorted by popularity or name. A card shows the connector's status and how many connections the workspace has of it.
 */
export const ConnectionLibraryBase = (props: ConnectionLibraryBaseProps) => (
    <div className={classNames.filters}>
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
            <div className={classNames.sort}>
                <Select
                    label={props.props.sortLabel}
                    isLabelHidden
                    options={[...props.props.sortOptions]}
                    value={props.props.sort}
                    onValueChange={(value) => props.on.sort(value ?? "popular")}
                />
            </div>
        </div>
        <TagGroup
            label={props.props.categoryLabel}
            selectionMode="single"
            selectedIds={[props.props.category]}
            onSelectionChange={(ids: ReadonlyArray<string>) => props.on.category(ids[0] ?? "all")}
            items={[...props.props.categories]}
        />
        <TagGroup
            label={props.props.audienceLabel}
            selectionMode="single"
            selectedIds={[props.props.audience]}
            onSelectionChange={(ids: ReadonlyArray<string>) => props.on.audience(ids[0] ?? "all")}
            items={[...props.props.audiences]}
        />
        {props.props.cards.length === 0 ? (
            <EmptyNotice message={props.props.emptyMessage} description={props.props.emptyHint} />
        ) : (
            renderConnectionCards(props)
        )}
    </div>
)

/** Draws the div section of the ConnectionLibrary view. */
const renderConnectionCards = (props: ConnectionLibraryBaseProps) => (
    <div className={classNames.grid}>
        {props.props.cards.map((card) => (
            <div key={card.id} {...(card.guide === undefined ? {} : { "data-guide": `connections.${card.guide}` })}>
                <SurfaceCard label={card.name} headingLevel={3}>
                    <div className={classNames.card}>
                        <div className={classNames.cardHead}>
                            <ProviderLogo glyph={card.glyph} {...(card.logo === undefined ? {} : { src: card.logo })} />
                            <Text size="sm" tone="muted">
                                {card.categoryLabel}
                            </Text>
                        </div>
                        <Text size="sm" tone="muted" overflow="clamp-2">
                            {card.blurb}
                        </Text>
                        <div className={classNames.cardFoot}>
                            {card.badge === null ? null : (
                                <Badge
                                    tone={card.badge.tone}
                                    isDot={card.badge.isDot}
                                    isSkeleton={props.props.isLoading}
                                >
                                    {card.badge.label}
                                </Badge>
                            )}
                            <Button
                                variant="outline"
                                size="sm"
                                isSkeleton={props.props.isLoading}
                                onPress={() => props.on.open(card.id)}
                            >
                                {card.actionLabel}
                            </Button>
                        </div>
                    </div>
                </SurfaceCard>
            </div>
        ))}
    </div>
)
