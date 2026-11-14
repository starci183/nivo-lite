import { Cluster, EmptyNotice, ListBox, LogoStack, SurfaceCard, Text, type ListBoxItem } from "@starci/grammar/common"
import { nivoIconSource } from "@/components/leaves/Icon"
import { PersonAvatar } from "@/components/leaves/PersonAvatar"
import type { ContactListRowView, ContactsListData, ContactsPanesCopy } from "@/modules/types"

/** What the list card draws and does. */
interface ContactListCardProps {
    readonly copy: Pick<
        ContactsPanesCopy,
        "listTitle" | "listLabel" | "channelsLabel" | "moreLabel" | "noMatchTitle" | "noMatchBody"
    >
    readonly data: ContactsListData
    readonly selectedId: string | null
    readonly isLoading: boolean
    readonly onSelect: (id: string) => void
    readonly onMore: () => void
}

/** The channels a person is reached on as the Grammar's row of logos, each named for assistive technology; a channel with no mark of its own wears a chat glyph. */
const channelsOf = (row: ContactListRowView, label: string) => (
    <LogoStack
        label={label}
        max={4}
        items={row.channels.map((channel) => ({
            id: channel.name,
            label: channel.name,
            ...(channel.logo === null
                ? { iconSource: nivoIconSource("moduleChatbot", "leading") }
                : { src: channel.logo }),
        }))}
    />
)

/** One person as a row of the list: the mark of the name, the name, and under it, when they were last seen (muted, at the start) and the channels (at the end). */
const itemOf = (row: ContactListRowView, channelsLabel: string): ListBoxItem => ({
    id: row.id,
    label: row.name,
    description: (
        <Cluster gap="inline" justify="between" wrap={false}>
            <Text as="span" size="xs" tone="muted">
                {row.time}
            </Text>
            {row.channels.length === 0 ? null : channelsOf(row, channelsLabel)}
        </Cluster>
    ),
    leading: <PersonAvatar name={row.isUnknown ? "?" : row.name} seed={row.id} size="md" />,
})

/**
 * The people the agents work with as one card on the well: its label with the count (left out while more pages follow, since only
 * what was read is counted), a row per person with the open one filled, and the way to read the next page under the rows.
 */
export const ContactListCard = (props: ContactListCardProps) => (
    <SurfaceCard
        label={props.copy.listTitle}
        headingLevel={2}
        isLoading={props.isLoading}
        {...(props.data.hasMore ? {} : { count: props.data.rows.length })}
        {...(props.data.hasMore
            ? { footers: [{ kind: "more" as const, label: props.copy.moreLabel, press: props.onMore }] }
            : {})}
    >
        <ListBox
            label={props.copy.listLabel}
            selectionMode="single"
            selectionIndicator="none"
            selectedIds={props.selectedId === null ? [] : [props.selectedId]}
            onSelectionChange={(ids) => {
                const id = ids[0]
                if (id !== undefined) props.onSelect(id)
            }}
            items={props.data.rows.map((row) => itemOf(row, props.copy.channelsLabel))}
            isLoading={props.isLoading}
            emptyContent={
                <EmptyNotice
                    message={props.copy.noMatchTitle}
                    iconSource={nivoIconSource("search", "leading")}
                    description={props.copy.noMatchBody}
                />
            }
        />
    </SurfaceCard>
)
