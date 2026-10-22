import { Badge } from "@starci/grammar/common"

/** What the chip names. */
type ThreadMentionChipProps = {
    readonly name: string
}

/** A person, agent or group an author tagged, as a chip inside a message. */
export const ThreadMentionChip = (props: ThreadMentionChipProps) => <Badge tone="accent">{`@${props.name}`}</Badge>
