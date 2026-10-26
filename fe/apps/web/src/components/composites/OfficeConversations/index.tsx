import { useState } from "react"
import type { ReactNode } from "react"
import { AvatarGroup, Badge, Divider, ListBox, NavLandmark, SearchField, Tabs, Text } from "@starci/grammar/common"
import type { AvatarGroupItem, ListBoxItem } from "@starci/grammar/common"
import { OfficeAvatar } from "@/components/branches/OfficeAvatar"
import { Icon } from "@/components/leaves/Icon"
import type {
    OfficeConversationRowView,
    OfficeConversationsProps,
    OfficeText,
    OfficeUnreadBadgeView,
} from "@/modules/types"
import {
    BODY_CLASS_NAME,
    HEAD_CLASS_NAME,
    HEAD_TEXT_CLASS_NAME,
    INDICATOR_CLASS_NAME,
    SEARCH_CLASS_NAME,
    TABS_CLASS_NAME,
    TRAILING_CLASS_NAME,
} from "./classNames"

const contains = (value: string, query: string): boolean => value.toLowerCase().includes(query.toLowerCase())

const FILTER_IDS = ["all", "groups", "customers", "unread"] as const
type FilterId = (typeof FILTER_IDS)[number]

const FILTER_KEYS: Record<FilterId, string> = {
    all: "filterAll",
    groups: "filterGroups",
    customers: "filterCustomers",
    unread: "filterUnread",
}

const isFilterId = (key: string): key is FilterId => key in FILTER_KEYS

const inFilter = (row: OfficeConversationRowView, filter: FilterId): boolean => {
    if (filter === "all") return true
    if (filter === "groups") return row.kind === "group"
    if (filter === "customers") return row.kind === "customer"
    return row.unread > 0
}

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
const leadingOf = (row: OfficeConversationRowView, text: OfficeText): ListBoxItem["leading"] => {
    if (row.kind !== "group") return <OfficeAvatar avatar={row.avatar} />
    return (
        <AvatarGroup
            label={row.label}
            layout="grid"
            items={memberItemsOf(row)}
            overflowLabel={(n) => text("membersOverflow", { n })}
        />
    )
}

/** The unread indicator: the capped count in red with an accent "@" before it for a mention, or a red dot when muted. */
const badgeOf = (badge: OfficeUnreadBadgeView): ReactNode => {
    if (badge.kind === "dot") return <Badge tone="danger" isDot />
    return (
        <>
            {badge.hasMention ? (
                <Text as="span" size="xs" tone="accent" weight="semibold">
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
        {row.time === null ? null : (
            <Text size="xs" tone="muted">
                {row.time}
            </Text>
        )}
        <div className={INDICATOR_CLASS_NAME}>
            {row.isLastSeen ? (
                <Text
                    as="span"
                    size="sm"
                    tone="accent"
                    startContent={
                        <>
                            <Icon props={{ name: "messageSeen", usage: "chip" }} />
                            <Icon props={{ name: "messageSeen", usage: "chip" }} />
                        </>
                    }
                />
            ) : null}
            {row.badge === null ? null : badgeOf(row.badge)}
        </div>
    </div>
)

/** What the list draws when the search or the filter leaves no row. */
const emptyContentOf = (q: string, filter: FilterId, text: OfficeText): ReactNode => (
    <Text size="sm" tone="muted">
        {q !== "" ? text("noMatches", { q }) : text(filter === "unread" ? "emptyUnread" : "emptyList")}
    </Text>
)

/** The rows of the one conversation list. */
const itemsOf = (rows: ReadonlyArray<OfficeConversationRowView>, text: OfficeText): ReadonlyArray<ListBoxItem> =>
    rows.map((row) => ({
        id: row.id,
        label: row.label,
        description: row.description,
        ...(row.isUnread ? { emphasis: "unread" as const } : {}),
        leading: leadingOf(row, text),
        trailing: trailingOf(row),
    }))

/** The left column: the panel title, search, the filter tabs and one conversation list, newest first. */
export const OfficeConversations = (props: OfficeConversationsProps) => {
    const { list, text, isLoading } = props.props
    const [query, setQuery] = useState("")
    const [filter, setFilter] = useState<FilterId>("all")
    const q = query.trim()
    const rows = list.conversations.filter((row) => inFilter(row, filter) && (q === "" || contains(row.label, q)))

    const open = (id: string) => {
        const row = list.conversations.find((entry) => entry.id === id)
        if (row === undefined) return
        if (row.kind === "group") props.on.openGroup(id)
        else if (row.kind === "agent") props.on.openAgent(id)
        else props.on.openCustomer(id)
    }

    return (
        <>
            <div className={HEAD_CLASS_NAME}>
                <div className={HEAD_TEXT_CLASS_NAME}>
                    <Text weight="semibold">{text("listTitle")}</Text>
                </div>
            </div>
            <Divider semantics="presentation" />
            <div className={SEARCH_CLASS_NAME}>
                <SearchField
                    label={text("searchLabel")}
                    isLabelHidden
                    placeholder={text("searchPlaceholder")}
                    clearLabel={text("clearSearch")}
                    value={query}
                    onValueChange={setQuery}
                    onClear={() => setQuery("")}
                />
            </div>
            <div className={TABS_CLASS_NAME}>
                <Tabs
                    label={text("filterLabel")}
                    variant="secondary"
                    selectedKey={filter}
                    onSelect={(key) => {
                        if (isFilterId(key)) setFilter(key)
                    }}
                    items={FILTER_IDS.map((id) => ({ id, label: text(FILTER_KEYS[id]) }))}
                />
            </div>
            <NavLandmark label={text("listLabel")} layout="scrolling" className={BODY_CLASS_NAME}>
                <ListBox
                    label={text("listLabel")}
                    selectionMode="single"
                    selectedIds={[list.selectedRoom]}
                    onAction={open}
                    onSelectionChange={(ids) => {
                        const id = ids[0]
                        if (id !== undefined) open(id)
                    }}
                    isLoading={isLoading}
                    loadingRows={6}
                    emptyContent={emptyContentOf(q, filter, text)}
                    items={itemsOf(rows, text)}
                />
            </NavLandmark>
        </>
    )
}
