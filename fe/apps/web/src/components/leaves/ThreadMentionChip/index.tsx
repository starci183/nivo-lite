import { Text } from "@starci/grammar/common"

/** What the mention names. */
type ThreadMentionChipProps = {
    readonly name: string
}

/** A person, agent or group an author tagged, as plain text of the message (inherited weight and colour). */
export const ThreadMentionChip = (props: ThreadMentionChipProps) => <Text as="span">{`@${props.name}`}</Text>
