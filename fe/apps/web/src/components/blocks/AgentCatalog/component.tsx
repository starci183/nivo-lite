import type { ReactNode } from "react"
import {
    EmptyNotice,
    Heading,
    HorizontalScrollRegion,
    Region,
    SearchField,
    SegmentedControl,
    SurfaceCard,
    Text,
} from "@starci/grammar/common"
import { AgentCatalogCard, type AgentCatalogCardProps } from "@/components/composites/AgentCatalogCard"
import { AgentTeamCard, type AgentTeamCardProps } from "@/components/composites/AgentTeamCard"
import { SlotView } from "@/components/composites/SlotView"
import type { DataSlot, SlotLabels } from "@/modules/types"
import { GRID, REGIONS, SECTION, SECTION_HEAD, TOOLBAR, TOOLBAR_SEARCH } from "./classNames"

/** One installed agent of the first section with the key the card is listed by. */
export interface AgentCatalogTeamEntry {
    readonly key: string
    readonly card: AgentTeamCardProps
}

/** One role card of the second section with the key the handlers name it by. */
export interface AgentCatalogRoleEntry {
    readonly key: string
    readonly card: Omit<AgentCatalogCardProps, "onInstall" | "isInstalling" | "isBlocked">
}

/** Copy, state and commands of the agent catalogue. */
export interface AgentCatalogBaseProps {
    readonly props: {
        readonly yoursTitle: string
        readonly yoursEmptyTitle: string
        readonly yoursEmptyHint: string
        readonly team: ReadonlyArray<AgentCatalogTeamEntry>
        readonly addTitle: string
        readonly searchLabel: string
        readonly searchPlaceholder: string
        readonly clearLabel: string
        readonly query: string
        readonly categoryLabel: string
        readonly categoryOptions: ReadonlyArray<{ readonly value: string; readonly label: string }>
        readonly category: string
        readonly roles: ReadonlyArray<AgentCatalogRoleEntry>
        readonly emptyTitle: string
        readonly emptyHint: string
        readonly emptyAction: string | undefined
        readonly slot: DataSlot<boolean>
        readonly slotLabels: SlotLabels
        readonly busyKey: string | null
        readonly isLoading: boolean
    }
    readonly on: {
        readonly query: (value: string) => void
        readonly category: (value: string) => void
        readonly clear: () => void
        readonly retry: () => void
        readonly install: (key: string) => void
    }
}

/** The cards a loading section draws. */
const SKELETON_KEYS = ["a", "b", "c"] as const

/** The words of a waiting team card. */
const SKELETON_TEAM_CARD: AgentTeamCardProps = {
    name: "...",
    seed: "...",
    avatarUrl: null,
    roleName: "...",
    statusLabel: "...",
    statusTone: "neutral",
    href: "#",
    isLoading: true,
}

/** The catalogue with the section that draws itself from the loading state. */
type CatalogSlotProps = AgentCatalogBaseProps & { readonly children: (isSkeleton: boolean) => ReactNode }

/** What an empty section says, and the optional way out. */
type CatalogEmptyProps = {
    readonly title: string
    readonly hint: string
    readonly action?: { readonly label: string; readonly onAction: () => void }
}

/** The notice of a section with nothing to show. */
const CatalogEmpty = (props: CatalogEmptyProps) => (
    <SurfaceCard ariaLabel={props.title}>
        <EmptyNotice
            message={props.title}
            description={props.hint}
            {...(props.action === undefined
                ? {}
                : { actionLabel: props.action.label, onAction: props.action.onAction })}
        />
    </SurfaceCard>
)

/** The loading, error and forbidden states of the catalogue data around a section; the section draws itself from `isSkeleton`. */
const CatalogSlot = (props: CatalogSlotProps) => (
    <SlotView slot={props.props.slot} placeholder={false} labels={props.props.slotLabels} onRetry={props.on.retry}>
        {(_, isSkeleton) => props.children(isSkeleton)}
    </SlotView>
)

/** The installed agents as compact cards. */
const Team = (props: AgentCatalogBaseProps) => (
    <Region label={props.props.yoursTitle}>
        <div className={SECTION}>
            <div className={SECTION_HEAD}>
                <Heading level={2}>{props.props.yoursTitle}</Heading>
                <Text size="sm" tone="muted" isSkeleton={props.props.isLoading}>
                    {String(props.props.team.length)}
                </Text>
            </div>
            <CatalogSlot {...props}>
                {(isSkeleton) => (
                    <>
                        {props.props.team.length === 0 && !isSkeleton ? (
                            <CatalogEmpty title={props.props.yoursEmptyTitle} hint={props.props.yoursEmptyHint} />
                        ) : null}
                        <div className={GRID}>
                            {isSkeleton && props.props.team.length === 0
                                ? SKELETON_KEYS.map((key) => <AgentTeamCard key={key} {...SKELETON_TEAM_CARD} />)
                                : props.props.team.map((entry) => <AgentTeamCard key={entry.key} {...entry.card} />)}
                        </div>
                    </>
                )}
            </CatalogSlot>
        </div>
    </Region>
)

/** Adds the clear action only when its localized label is available. */
const emptyActionOf = (props: AgentCatalogBaseProps) =>
    props.props.emptyAction === undefined
        ? {}
        : { action: { label: props.props.emptyAction, onAction: props.on.clear } }

/** The roles that can still be added: search, one group filter, the cards. */
const Roles = (props: AgentCatalogBaseProps) => (
    <Region label={props.props.addTitle}>
        <div className={SECTION}>
            <Heading level={2}>{props.props.addTitle}</Heading>
            <div className={TOOLBAR}>
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
                <HorizontalScrollRegion>
                    <SegmentedControl
                        label={props.props.categoryLabel}
                        isLabelHidden
                        isSkeleton={props.props.isLoading}
                        options={props.props.categoryOptions}
                        value={props.props.category}
                        onValueChange={props.on.category}
                    />
                </HorizontalScrollRegion>
            </div>
            <CatalogSlot {...props}>
                {(isSkeleton) => (
                    <>
                        {props.props.roles.length === 0 && !isSkeleton ? (
                            <CatalogEmpty
                                title={props.props.emptyTitle}
                                hint={props.props.emptyHint}
                                {...emptyActionOf(props)}
                            />
                        ) : null}
                        <div className={GRID}>
                            {props.props.roles.map((entry) => (
                                <AgentCatalogCard
                                    key={entry.key}
                                    {...entry.card}
                                    isInstalling={props.props.busyKey === entry.key}
                                    isBlocked={props.props.busyKey !== null}
                                    onInstall={() => props.on.install(entry.key)}
                                />
                            ))}
                        </div>
                    </>
                )}
            </CatalogSlot>
        </div>
    </Region>
)

/** Draws the catalogue: the installed agents, then the roles that can be added. */
export const AgentCatalogBase = (props: AgentCatalogBaseProps) => (
    <div className={REGIONS}>
        <Team {...props} />
        <Roles {...props} />
    </div>
)
