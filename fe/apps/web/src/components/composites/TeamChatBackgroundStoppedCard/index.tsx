import { useState } from "react"
import { Badge, Button, Cluster, MessageCard, Stack, SurfaceCard, Text, TextAction } from "@starci/grammar/common"
import { ChatPartyMark } from "@/components/branches/ChatPartyMark"
import type { TeamChatBackgroundStoppedView } from "@/modules/types"

/** One "background work stopped" card of the NIVO room. */
interface TeamChatBackgroundStoppedCardProps {
    readonly card: TeamChatBackgroundStoppedView
}

/**
 * The card NIVO posts when work it does in the background stopped, drawn by the same Grammar `MessageCard` as the stop card: NIVO's mark
 * and name over the work and the time, a neutral Badge without a dot, the title, one sentence for the reason, then one neutral small
 * button to the place the work is retried (none for a target the web does not know) and "Details" at the row end, which unfolds the raw
 * facts as a bordered list. It only tells: no decision buttons, no reactions.
 */
export const TeamChatBackgroundStoppedCard = (props: TeamChatBackgroundStoppedCardProps) => {
    const { card } = props
    const [isOpen, setIsOpen] = useState(false)
    return (
        <MessageCard
            measure="wide"
            author={card.author}
            meta={card.meta}
            avatar={<ChatPartyMark size="sm" mark={card.mark} />}
            title={card.title}
            chip={<Badge tone="neutral">{card.chip}</Badge>}
            body={
                <Stack gap="row">
                    <Text>{card.message}</Text>
                    <Cluster gap="inline" justify={card.action === null ? "end" : "between"}>
                        {card.action === null ? null : (
                            <Button intent="neutral" size="sm" href={card.action.href}>
                                {card.action.label}
                            </Button>
                        )}
                        <TextAction appearance="plain" size="sm" onPress={() => setIsOpen((wasOpen) => !wasOpen)}>
                            {card.detailsLabel}
                        </TextAction>
                    </Cluster>
                    {isOpen ? (
                        <SurfaceCard
                            kind="list"
                            layout="keyValue"
                            ariaLabel={card.factsLabel}
                            empty={null}
                            items={card.facts.map((line) => ({ id: line.id, title: line.name, value: line.value }))}
                        />
                    ) : null}
                </Stack>
            }
        />
    )
}
