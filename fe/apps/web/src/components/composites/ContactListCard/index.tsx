import { Cluster, EmptyNotice, Image, ListBox, SurfaceCard, Text, type ListBoxItem } from "@starci/grammar/common"
import { nivoIconSource } from "@/components/leaves/Icon"
import { PersonAvatar } from "@/components/leaves/PersonAvatar"
import type { ContactListRowView, ContactsListData, ContactsPanesCopy } from "@/modules/types"
import { contactListClassNames } from "./classNames"

/** What the list card draws and does. */
interface ContactListCardProps {
    readonly copy: Pick<ContactsPanesCopy, "listTitle" | "listLabel" | "moreLabel" | "noMatchTitle" | "noMatchBody">
    readonly data: ContactsListData
    readonly selectedId: string | null
    readonly isLoading: boolean
    readonly onSelect: (id: string) => void
    readonly onMore: () => void
}

/** The channels a person is reached on as one row of small marks: the channel's own mark, or its name when the app has none. */
const channelsOf = (row: ContactListRowView) => (
    <Cluster gap="inline">
        {row.channels.map((channel) =>
            channel.logo === null ? (
                <Text key={channel.name} as="span" size="xs" tone="muted">
                    {channel.name}
                </Text>
            ) : (
                <div key={channel.name} className={contactListClassNames.mark}>
                    <Image
                        src={channel.logo}
                        alt={channel.name}
                        aspect="square"
                        fit="contain"
                        plate="none"
                        width={16}
                        height={16}
                    />
                </div>
            ),
        )}
    </Cluster>
)

/** One person as a row of the list: the mark of the name, the name, when they were last seen (muted) and the channels under it. */
const itemOf = (row: ContactListRowView): ListBoxItem => ({
    id: row.id,
    label: row.name,
    description: (
        <Text as="span" size="xs" tone="muted">
            {row.time}
        </Text>
    ),
    ...(row.channels.length === 0 ? {} : { footer: channelsOf(row) }),
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
            items={props.data.rows.map((row) => itemOf(row))}
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
