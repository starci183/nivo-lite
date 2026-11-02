import { Button, Cluster, EmptyNotice, Section, Stack, SurfaceCard, Text } from "@starci/grammar/common"
import type { BadgeTone, ListRowData } from "@starci/grammar/common"
import { nivoIconSource, type IconName } from "@/components/leaves/Icon"
import type { ModuleIconName } from "@/modules/types"
import { AgentMark } from "@/components/leaves/AgentMark"
import { PersonAvatar } from "@/components/leaves/PersonAvatar"

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
        readonly isLoading: boolean
    }
    readonly on: {
        readonly openEmptyAction: () => void
        readonly draft: (responsibilityId: string) => void
    }
}

const emptyOf = (props: OverviewOwnersBaseProps) => (
    <EmptyNotice
        message={props.props.emptyMessage}
        description={props.props.emptyDescription}
        actionLabel={props.props.emptyActionLabel}
        onAction={props.on.openEmptyAction}
    />
)

/** Draws a responsibility as typed list data with its optional drafting command. */
const rowOf = (row: OverviewOwnersRow, props: OverviewOwnersBaseProps): ListRowData => ({
    id: row.id,
    title: row.title,
    leading: { icon: nivoIconSource(row.icon, "leading") },
    description: row.customer,
    badges: [{ label: row.statusLabel, tone: row.statusTone, isDot: true }],
    action: { label: row.openLabel, href: row.openHref },
    detail: (
        <Stack gap="row">
            <Cluster gap="inline">
                <Text size="xs" tone="muted">
                    {row.ownerText}
                </Text>
                {row.dueText === null ? null : (
                    <Text size="xs" tone={row.isOverdue ? "default" : "muted"} isStrong={row.isOverdue}>
                        {row.dueText}
                    </Text>
                )}
            </Cluster>
            {row.nextText === null ? null : <Text size="sm">{row.nextText}</Text>}
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
        </Stack>
    ),
})

/** The open work grouped by owner, each list carrying its own label and empty state. */
export const OverviewOwnersBase = (props: OverviewOwnersBaseProps) => (
    <Section
        title={props.props.title}
        description={props.props.description}
        headingLevel={2}
        isLoading={props.props.isLoading}
    >
        <Stack gap="row">
            {props.props.groups.length === 0 ? (
                <SurfaceCard
                    kind="list"
                    ariaLabel={props.props.listLabel}
                    isLoading={props.props.isLoading}
                    items={[]}
                    empty={emptyOf(props)}
                />
            ) : (
                props.props.groups.map((group) => (
                    <SurfaceCard
                        key={group.key}
                        kind="list"
                        label={group.name}
                        isLoading={props.props.isLoading}
                        labelEnd={
                            <Cluster gap="inline">
                                {group.glyph === null ? (
                                    <PersonAvatar name={group.name} size="md" isLoading={props.props.isLoading} />
                                ) : (
                                    <AgentMark
                                        label={group.name}
                                        seed={group.key}
                                        src={group.avatarUrl}
                                        size="md"
                                        isLoading={props.props.isLoading}
                                    />
                                )}
                                <Text size="sm" tone="muted">
                                    {group.roleText}
                                </Text>
                                <Text size="sm" tone="muted">
                                    {group.countText}
                                </Text>
                            </Cluster>
                        }
                        items={group.rows.map((row) => rowOf(row, props))}
                        empty={emptyOf(props)}
                    />
                ))
            )}
        </Stack>
    </Section>
)
