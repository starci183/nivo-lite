import {
    Badge,
    Button,
    EmptyNotice,
    ListRow,
    SectionHeader,
    SurfaceCard,
    SurfaceListCard,
    Text,
} from "@starci/grammar/common"
import type { BadgeTone } from "@starci/grammar/common"
import { TileIcon } from "@/components/composites/TileIcon"
import type { IconName } from "@/components/leaves/Icon"
import { AgentMark } from "@/components/leaves/AgentMark"
import { PersonAvatar } from "@/components/leaves/PersonAvatar"
import {
    GROUPS_CLASS_NAME,
    MAIN_CLASS_NAME,
    META_CLASS_NAME,
    OWNER_MARK_CLASS_NAME,
    OWNER_TEXT_CLASS_NAME,
    SECTION_CLASS_NAME,
    SECTION_HEAD_CLASS_NAME,
} from "./classNames"

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
    readonly glyph: string | null
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
    }
    readonly on: {
        readonly openEmptyAction: () => void
        readonly draft: (responsibilityId: string) => void
    }
}

/** The open work grouped by owner: a header per owner, then one row per responsibility, or an empty notice. */
export const OverviewOwnersBase = (props: OverviewOwnersBaseProps) => (
    <div className={MAIN_CLASS_NAME}>
        <SectionHeader level={2} title={props.props.title} description={props.props.description} />
        {props.props.groups.length === 0 ? (
            <SurfaceCard ariaLabel={props.props.listLabel}>
                <EmptyNotice
                    message={props.props.emptyMessage}
                    description={props.props.emptyDescription}
                    actionLabel={props.props.emptyActionLabel}
                    actionVariant="secondary"
                    onAction={props.on.openEmptyAction}
                />
            </SurfaceCard>
        ) : (
            <div className={GROUPS_CLASS_NAME}>
                {props.props.groups.map((group) => (
                    <section key={group.key} className={SECTION_CLASS_NAME} aria-label={group.ariaLabel}>
                        <div className={SECTION_HEAD_CLASS_NAME}>
                            <div className={OWNER_MARK_CLASS_NAME}>
                                {group.glyph === null ? (
                                    <PersonAvatar name={group.name} size="md" />
                                ) : (
                                    <AgentMark glyph={group.glyph} label={group.name} module={group.module} size="md" />
                                )}
                                <div className={OWNER_TEXT_CLASS_NAME}>
                                    <Text weight="semibold" overflow="truncate">
                                        {group.name}
                                    </Text>
                                    <Text size="sm" tone="muted" overflow="truncate">
                                        {group.roleText}
                                    </Text>
                                </div>
                            </div>
                            <Text size="sm" tone="muted">
                                {group.countText}
                            </Text>
                        </div>
                        <SurfaceListCard ariaLabel={group.cardsLabel}>
                            {group.rows.map((row) => (
                                <ListRow
                                    key={row.id}
                                    leading={
                                        <TileIcon
                                            props={{ icon: row.icon, signal: row.isOverdue ? "attention" : "none" }}
                                        />
                                    }
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
                                                    variant="ghost"
                                                    size="sm"
                                                    isPending={props.props.isDrafting}
                                                    onPress={() => props.on.draft(row.id)}
                                                >
                                                    {props.props.draftLabel}
                                                </Button>
                                            ) : null}
                                            <Button variant="outline" href={row.openHref}>
                                                {row.openLabel}
                                            </Button>
                                        </>
                                    }
                                >
                                    <div className={META_CLASS_NAME}>
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
                                    </div>
                                    {row.nextText === null ? null : <Text size="sm">{row.nextText}</Text>}
                                </ListRow>
                            ))}
                        </SurfaceListCard>
                    </section>
                ))}
            </div>
        )}
    </div>
)
