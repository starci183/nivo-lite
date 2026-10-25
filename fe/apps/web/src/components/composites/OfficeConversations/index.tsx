import { useState } from "react"
import type { ReactNode } from "react"
import { AvatarGroup, Badge, Icon, ListBox, NavLandmark, SearchField, Tabs, Text } from "@starci/grammar/common"
import type { AvatarGroupItem, ListBoxItem } from "@starci/grammar/common"
import { OfficeAvatar } from "@/components/branches/OfficeAvatar"
import { nivoIconSource } from "@/components/leaves/Icon"
import type { OfficeConversationRowView, OfficeConversationsProps, OfficeText } from "@/modules/types"
import {
    BODY_CLASS_NAME,
    GROUP_LEADING_CLASS_NAME,
    HEAD_CLASS_NAME,
    HEAD_TEXT_CLASS_NAME,
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

/** The member previews of a group row as composite-avatar items. */
const memberItemsOf = (row: Extract<OfficeConversationRowView, { kind: "group" }>): ReadonlyArray<AvatarGroupItem> =>
    (row.members?.preview ?? []).map((member, index) => ({
        id: `${row.id}-member-${index}`,
        name: member.name,
        seed: member.name,
        ...(member.avatarUrl === null ? {} : { src: member.avatarUrl }),
    }))

/** A group row leads with the member composite and the group glyph before the name; a direct row with its mark. */
const leadingOf = (row: OfficeConversationRowView, text: OfficeText): ListBoxItem["leading"] => {
    if (row.kind !== "group") return <OfficeAvatar avatar={row.avatar} />
    return (
        <div className={GROUP_LEADING_CLASS_NAME}>
            <AvatarGroup
                label={row.label}
                layout="grid"
                items={memberItemsOf(row)}
                overflowLabel={(n) => text("membersOverflow", { n })}
            />
            <Icon source={nivoIconSource("community", "chip")} />
        </div>
    )
}

/** The trailing cell of a row: the time over the unread badge. */
const trailingOf = (row: OfficeConversationRowView): ListBoxItem["trailing"] => (
    <div className={TRAILING_CLASS_NAME}>
        {row.time === null ? null : (
            <Text size="xs" tone="muted">
                {row.time}
            </Text>
        )}
        {row.unread > 0 ? <Badge tone="accent">{row.unread}</Badge> : null}
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
