import { Fragment } from "react"
import { Divider, EmptyNotice, Stack, SurfaceCard } from "@starci/grammar/common"
import { InboxJourneyEntry } from "@/components/composites/InboxJourneyEntry"
import { nivoIconSource } from "@/components/leaves/Icon"
import type { InboxCopy } from "@/modules/inbox"
import type { InboxDetailView } from "@/modules/types"

/** Props for {@link InboxJourneyCard}. */
export interface InboxJourneyCardProps {
    readonly props: {
        readonly copy: InboxCopy
        readonly detail: InboxDetailView
        /** Which entries show: `all`, `message` or `agent`. */
        readonly filter: string
    }
    readonly on: {
        readonly setFilter: (id: string) => void
    }
}

/**
 * The journey across channels as a chat, oldest first: the customer's messages, the shop's replies, the agents' cards and the milestones,
 * with a divider at each new day, as the team chat draws them. The three chips narrow it to the customer's messages or to the agents' work.
 */
export const InboxJourneyCard = (props: InboxJourneyCardProps) => {
    const { copy, detail, filter } = props.props
    const entries = detail.journey.filter((entry) => filter === "all" || entry.group === filter)
    return (
        <SurfaceCard
            label={copy.journeyTitle}
            headers={[
                {
                    kind: "switch",
                    label: copy.journeyLabel,
                    items: [
                        { id: "all", label: copy.journeyAll },
                        { id: "message", label: copy.journeyMessages },
                        { id: "agent", label: copy.journeyAgent },
                    ],
                    selectedKey: filter,
                    onSelect: props.on.setFilter,
                },
            ]}
        >
            {entries.length === 0 ? (
                <EmptyNotice message={copy.journeyEmpty} iconSource={nivoIconSource("history", "leading")} />
            ) : (
                <Stack gap="row">
                    {entries.map((entry, index) => (
                        <Fragment key={entry.id}>
                            {entries[index - 1]?.day === entry.day ? null : <Divider label={entry.dayLabel} />}
                            <InboxJourneyEntry
                                entry={entry}
                                customer={{ id: detail.id, name: detail.name }}
                                agent={detail.agent}
                            />
                        </Fragment>
                    ))}
                </Stack>
            )}
        </SurfaceCard>
    )
}
