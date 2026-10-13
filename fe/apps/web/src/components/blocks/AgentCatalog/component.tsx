import {
    Alert,
    EmptyNotice,
    Heading,
    Region,
    SearchField,
    SegmentedControl,
    Select,
    SurfaceCard,
    Text,
} from "@starci/grammar/common"
import { AgentCatalogCard } from "@/components/composites/AgentCatalogCard"
import type { AgentCatalogCardProps } from "@/components/composites/AgentCatalogCard"
import {
    CATEGORY,
    GRID,
    REGIONS,
    TOOLBAR,
    TOOLBAR_META,
    TOOLBAR_ROW,
    TOOLBAR_SEARCH,
    TOOLBAR_SELECT,
} from "./classNames"

/** One card of the catalogue with the key the handlers name it by. */
export interface AgentCatalogBoardCard {
    readonly key: string
    readonly card: Omit<AgentCatalogCardProps, "onInstall" | "isInstalling" | "isBlocked">
}

/** Copy, state and commands of the agent catalogue. */
export interface AgentCatalogBaseProps {
    readonly props: {
        readonly searchLabel: string
        readonly searchPlaceholder: string
        readonly clearLabel: string
        readonly query: string
        readonly categoryLabel: string
        readonly categoryOptions: ReadonlyArray<{ readonly id: string; readonly label: string }>
        readonly category: string
        readonly statusLabel: string
        readonly statusOptions: ReadonlyArray<{ readonly value: string; readonly label: string }>
        readonly status: string
        readonly resultCount: string
        readonly groups: ReadonlyArray<{
            readonly key: string
            readonly label: string
            readonly cards: ReadonlyArray<AgentCatalogBoardCard>
        }>
        readonly emptyTitle: string
        readonly emptyHint: string
        readonly emptyAction: string | undefined
        readonly errorTitle: string
        readonly error: string | undefined
        readonly busyKey: string | null
        readonly isLoading: boolean
    }
    readonly on: {
        readonly query: (value: string) => void
        readonly category: (value: string | null) => void
        readonly status: (value: string) => void
        readonly clear: () => void
        readonly install: (key: string) => void
    }
}

/** Draws the catalogue: toolbar, the categories with their cards, or the empty notice when nothing matches. */
export const AgentCatalogBase = (props: AgentCatalogBaseProps) => (
    <div className={REGIONS}>
        {props.props.error === undefined ? null : (
            <Alert title={props.props.errorTitle} description={props.props.error} tone="negative" />
        )}
        <div className={TOOLBAR}>
            <div className={TOOLBAR_ROW}>
                <div className={TOOLBAR_SEARCH}>
                    <SearchField
                        label={props.props.searchLabel}
                        isLabelHidden
                        placeholder={props.props.searchPlaceholder}
                        clearLabel={props.props.clearLabel}
                        value={props.props.query}
                        onValueChange={props.on.query}
                        isSkeleton={props.props.isLoading}
                    />
                </div>
                <div className={TOOLBAR_SELECT}>
                    <Select
                        label={props.props.categoryLabel}
                        isLabelHidden
                        isSkeleton={props.props.isLoading}
                        options={props.props.categoryOptions}
                        value={props.props.category}
                        onValueChange={props.on.category}
                    />
                </div>
            </div>
            <div className={TOOLBAR_META}>
                <SegmentedControl
                    label={props.props.statusLabel}
                    isLabelHidden
                    isSkeleton={props.props.isLoading}
                    options={props.props.statusOptions}
                    value={props.props.status}
                    onValueChange={props.on.status}
                />
                <Text size="sm" tone="muted" live="polite" isSkeleton={props.props.isLoading}>
                    {props.props.resultCount}
                </Text>
            </div>
        </div>
        {props.props.groups.length === 0 ? (
            <SurfaceCard ariaLabel={props.props.emptyTitle}>
                <EmptyNotice
                    message={props.props.emptyTitle}
                    description={props.props.emptyHint}
                    {...(props.props.emptyAction === undefined
                        ? {}
                        : { actionLabel: props.props.emptyAction, onAction: props.on.clear })}
                />
            </SurfaceCard>
        ) : null}
        {props.props.groups.map((group) => (
            <Region key={group.key} label={group.label}>
                <div className={CATEGORY}>
                    <Heading level={2}>{group.label}</Heading>
                    <div className={GRID}>
                        {group.cards.map((entry) => (
                            <AgentCatalogCard
                                key={entry.key}
                                {...entry.card}
                                isInstalling={props.props.busyKey === entry.key}
                                isBlocked={props.props.busyKey !== null}
                                onInstall={() => props.on.install(entry.key)}
                            />
                        ))}
                    </div>
                </div>
            </Region>
        ))}
    </div>
)
