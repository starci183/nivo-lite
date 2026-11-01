import { nivoIconSource, type IconName } from "@/components/leaves/Icon"
import { useMemo } from "react"
import type { ComponentProps } from "react"
import {
    Badge,
    Button,
    Cluster,
    EmptyNotice,
    ListRow,
    Region,
    SectionHeader,
    Stack,
    SurfaceCard,
    SurfaceListCard,
    Text,
} from "@starci/grammar/common"
import type { BadgeTone } from "@starci/grammar/common"
import { TileIcon } from "@/components/composites/TileIcon"
import type { ModuleIconName } from "@/modules/types"
import { AgentMark } from "@/components/leaves/AgentMark"
import { PersonAvatar } from "@/components/leaves/PersonAvatar"
import { OWNER_MARK_CLASS_NAME, OWNER_TEXT_CLASS_NAME } from "./classNames"

/** One responsibility row, already in the reader's words. */
export interface OverviewOwnersRow {
    readonly id: string
    readonly icon: IconName
    readonly isOverdue: boolean
    readonly title: string
    readonly statusLabel: string
    readonly statusTone: BadgeTone
    readonly customer: string
    readonly ownerText: string
    readonly dueText: string | null
    readonly nextText: string | null
    readonly openLabel: string
    readonly openHref: string
    readonly leadId: string
    readonly canDraft: boolean
}

/** One owner section. */
export interface OverviewOwnersGroup {
    readonly key: string
    readonly name: string
    readonly roleText: string
    readonly countText: string
    readonly ariaLabel: string
    readonly cardsLabel: string
    readonly glyph: ModuleIconName | null
    /** The picture the owner gave the agent; null draws the NIVO unicorn mascot. */
    readonly avatarUrl: string | null
    readonly module: string
    readonly rows: ReadonlyArray<OverviewOwnersRow>
}

/** The resolved words and groups of the open work by owner. */
interface OverviewOwnersBaseProps {
    readonly props: {
        readonly title: string
        readonly description: string
        readonly listLabel: string
        readonly groups: ReadonlyArray<OverviewOwnersGroup>
        readonly emptyMessage: string
        readonly emptyDescription: string
        readonly emptyActionLabel: string
        readonly draftLabel: string
        readonly isDrafting: boolean
        /** The dashboard is still read: the heading and one card of rows draw as skeleton. */
        readonly isSkeleton: boolean
    }
    readonly on: {
        readonly openEmptyAction: () => void
        readonly draft: (responsibilityId: string) => void
    }
}

const tilePropsOf = (row: OverviewOwnersRow): ComponentProps<typeof TileIcon>["props"] => ({
    icon: row.icon,
    signal: row.isOverdue ? "attention" : "none",
})

/** The open work grouped by owner: a header per owner, then one row per responsibility, or an empty notice. */
export const OverviewOwnersBase = (props: OverviewOwnersBaseProps) => {
    const groups = useMemo(
        () =>
            props.props.groups.map((group) => ({
                ...group,
                rows: group.rows.map((row) => ({ ...row, tileProps: tilePropsOf(row) })),
            })),
        [props.props.groups],
    )
    return (
        <Stack gap="section">
            <SectionHeader
                level={2}
                title={props.props.title}
                description={props.props.description}
                isSkeleton={props.props.isSkeleton}
            />
            <OwnersBody {...props} groups={groups} />
        </Stack>
    )
}

type OwnersBodyProps = OverviewOwnersBaseProps & {
    readonly groups: ReadonlyArray<Omit<OverviewOwnersGroup, "rows"> & { readonly rows: ReadonlyArray<OwnersTiledRow> }>
}

/** The rows of an owner section with the tile each one draws. */
type OwnersTiledRow = OverviewOwnersRow & { readonly tileProps: ComponentProps<typeof TileIcon>["props"] }

/** The placeholder card, the empty notice, or one section per owner. */
const OwnersBody = ({ groups, ...props }: OwnersBodyProps) => {
    if (props.props.isSkeleton) return <SurfaceListCard ariaLabel={props.props.listLabel} isLoading />
    if (groups.length === 0) {
        return (
            <SurfaceCard ariaLabel={props.props.listLabel}>
                <EmptyNotice
                    message={props.props.emptyMessage}
                    description={props.props.emptyDescription}
                    actionLabel={props.props.emptyActionLabel}
                    actionVariant="secondary"
                    onAction={props.on.openEmptyAction}
                />
            </SurfaceCard>
        )
    }
    return (
        <Stack gap="region">
            {groups.map((group) => (
                <Region key={group.key} label={group.ariaLabel}>
                    <Stack gap="row">
                        <Cluster gap="row" justify="between" wrap={false}>
                            <div className={OWNER_MARK_CLASS_NAME}>
                                <Cluster gap="row" wrap={false}>
                                    {group.glyph === null ? (
                                        <PersonAvatar name={group.name} size="md" />
                                    ) : (
                                        <AgentMark
                                            glyph={nivoIconSource(group.glyph, "leading")}
                                            label={group.name}
                                            seed={group.key}
                                            src={group.avatarUrl}
                                            module={group.module}
                                            size="md"
                                        />
                                    )}
                                    <div className={OWNER_TEXT_CLASS_NAME}>
                                        <Text weight="semibold" overflow="truncate">
                                            {group.name}
                                        </Text>
                                        <Text size="sm" tone="muted" overflow="truncate">
                                            {group.roleText}
                                        </Text>
                                    </div>
                                </Cluster>
                            </div>
                            <Text size="sm" tone="muted">
                                {group.countText}
                            </Text>
                        </Cluster>
                        <SurfaceListCard ariaLabel={group.cardsLabel}>
                            {group.rows.map((row) => (
                                <OverviewOwnerRow key={row.id} row={row} props={props.props} on={props.on} />
                            ))}
                        </SurfaceListCard>
                    </Stack>
                </Region>
            ))}
        </Stack>
    )
}

type OverviewOwnerRowProps = OverviewOwnersBaseProps & {
    readonly row: OverviewOwnersRow & { readonly tileProps: ComponentProps<typeof TileIcon>["props"] }
}

/** Renders one responsibility and its available actions. */
const OverviewOwnerRow = ({ row, ...props }: OverviewOwnerRowProps) => (
    <ListRow
        leading={<TileIcon props={row.tileProps} />}
        title={row.title}
        badges={
            <Badge tone={row.statusTone} isDot>
                {row.statusLabel}
            </Badge>
        }
        description={row.customer}
        actions={
            <>
                {row.canDraft ? (
                    <Button
                        intent="neutral"
                        size="sm"
                        isPending={props.props.isDrafting}
                        onPress={() => props.on.draft(row.id)}
                    >
                        {props.props.draftLabel}
                    </Button>
                ) : null}
                <Button intent="neutral" href={row.openHref}>
                    {row.openLabel}
                </Button>
            </>
        }
    >
        <Cluster gap="inline">
            <Text size="xs" tone="muted">
                {row.ownerText}
            </Text>
            {row.dueText === null ? null : (
                <Text
                    size="xs"
                    tone={row.isOverdue ? "accent" : "muted"}
                    weight={row.isOverdue ? "semibold" : "normal"}
                >
                    {row.dueText}
                </Text>
            )}
        </Cluster>
        {row.nextText === null ? null : <Text size="sm">{row.nextText}</Text>}
    </ListRow>
)
