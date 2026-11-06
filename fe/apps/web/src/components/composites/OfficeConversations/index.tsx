import type { ReactNode } from "react"
import {
    AvatarGroup,
    Badge,
    Cluster,
    ListBox,
    PaneSection,
    SearchField,
    Stack,
    Tabs,
    Text,
} from "@starci/grammar/common"
import type { AvatarGroupItem, ListBoxItem } from "@starci/grammar/common"
import { OfficeAvatar } from "@/components/branches/OfficeAvatar"
import { Icon } from "@/components/leaves/Icon"
import type { OfficeConversationRowView, OfficeConversationsProps, OfficeUnreadBadgeView } from "@/modules/types"
import { TRAILING_CLASS_NAME } from "./classNames"

/** Silent placeholders for the members the preview does not name; the grid counts them but never draws them. */
const padItems = (rowId: string, n: number): ReadonlyArray<AvatarGroupItem> =>
    Array.from({ length: n }, (_, index) => ({ id: `${rowId}-member-pad-${index}`, name: "" }))

/** The member previews of a group row as composite-avatar items. */
const memberItemsOf = (row: Extract<OfficeConversationRowView, { kind: "group" }>): ReadonlyArray<AvatarGroupItem> => {
    const preview = (row.members?.preview ?? []).map((member, index) => ({
        id: `${row.id}-member-${index}`,
        name: member.name,
        seed: member.name,
        ...(member.avatarUrl === null ? {} : { src: member.avatarUrl }),
    }))
    // The grid's fourth cell draws the TOTAL count from items.length once it passes four, so five
    // or more members draw three avatars plus the count cell.
    const total = Math.max(row.members?.count ?? 0, preview.length)
    return [...preview, ...padItems(row.id, total > 4 ? total - preview.length : 0)]
}

/** A group row leads with its member composite and nothing else; a direct row with its mark. */
const leadingOf = (
    row: OfficeConversationRowView,
    formatMembersOverflow: OfficeConversationsProps["on"]["formatMembersOverflow"],
): ListBoxItem["leading"] => {
    if (row.kind !== "group") return <OfficeAvatar avatar={row.avatar} />
    return (
        <AvatarGroup label={row.label} layout="grid" items={memberItemsOf(row)} overflowLabel={formatMembersOverflow} />
    )
}

/** The unread indicator: the capped count in red with an accent "@" before it for a mention, or a red dot when muted. */
const badgeOf = (badge: OfficeUnreadBadgeView): ReactNode => {
    if (badge.kind === "dot") return <Badge tone="danger" isDot />
    return (
        <>
            {badge.hasMention ? (
                <Text as="span" size="xs" isStrong>
                    @
                </Text>
            ) : null}
            <Badge tone="danger">{badge.label}</Badge>
        </>
    )
}

/** The trailing cell of a row: the time, over the double check of my read last line and the unread indicator. */
const trailingOf = (row: OfficeConversationRowView): ListBoxItem["trailing"] => (
    <div className={TRAILING_CLASS_NAME}>
        <Stack gap="identity" align="end">
            {row.time === null ? null : (
                <Text size="xs" tone="muted">
                    {row.time}
                </Text>
            )}
            <Cluster gap="identity" wrap={false}>
                {row.isLastSeen ? (
                    <Text
                        as="span"
                        size="sm"
                        isStrong
                        startContent={
                            <>
                                <Icon props={{ name: "messageSeen", usage: "chip" }} />
                                <Icon props={{ name: "messageSeen", usage: "chip" }} />
                            </>
                        }
                    />
                ) : null}
                {row.badge === null ? null : badgeOf(row.badge)}
            </Cluster>
        </Stack>
    </div>
)

/** The rows of the one conversation list. */
const itemsOf = (
    rows: ReadonlyArray<OfficeConversationRowView>,
    formatMembersOverflow: OfficeConversationsProps["on"]["formatMembersOverflow"],
): ReadonlyArray<ListBoxItem> =>
    rows.map((row) => ({
        id: row.id,
        label: row.label,
        description: row.description,
        ...(row.isUnread ? { emphasis: "unread" as const } : {}),
        leading: leadingOf(row, formatMembersOverflow),
        trailing: trailingOf(row),
    }))

/**
 * The left column body as three bands of its pane: the search, the filter tabs, and the one conversation list (newest
 * first), which scrolls alone under them.
 */
export const OfficeConversations = (props: OfficeConversationsProps) => {
    const { list, isLoading, query, filter, filters, copy } = props.props
    const rows = list.conversations

    const open = (id: string) => {
        const row = list.conversations.find((entry) => entry.id === id)
        if (row === undefined) return
        if (row.kind === "group") props.on.openGroup(id)
        else props.on.openAgent(id)
    }

    return (
        <>
            <PaneSection>
                <SearchField
                    label={copy.searchLabel}
                    isLabelHidden
                    placeholder={copy.searchPlaceholder}
                    clearLabel={copy.clearSearch}
                    value={query}
                    onValueChange={props.on.query}
                    onClear={() => props.on.query("")}
                />
            </PaneSection>
            <PaneSection>
                <Tabs label={copy.filterLabel} selectedKey={filter} onSelect={props.on.filter} items={filters} />
            </PaneSection>
            <PaneSection scroll={{ label: copy.listLabel }}>
                <ListBox
                    label={copy.listLabel}
                    selectionMode="single"
                    selectionIndicator="none"
                    selectedIds={[list.selectedRoom]}
                    onAction={open}
                    onSelectionChange={(ids) => {
                        const id = ids[0]
                        if (id !== undefined) open(id)
                    }}
                    isLoading={isLoading}
                    emptyContent={
                        <Text size="sm" tone="muted">
                            {copy.empty}
                        </Text>
                    }
                    items={itemsOf(rows, props.on.formatMembersOverflow)}
                />
            </PaneSection>
        </>
    )
}
