import { Stack, Text } from "@starci/grammar/common"

/** What the removal dialog's body draws. */
interface AgentRemoveImpactProps {
    /** What removing the agent says: what is erased and what stays, one plain sentence a line. */
    readonly lines: ReadonlyArray<string>
}

/** The body of the removal confirmation: the sentences, one a line. */
export const AgentRemoveImpact = (props: AgentRemoveImpactProps) => (
    <Stack gap="inline">
        {props.lines.map((line) => (
            <Text key={line} size="sm">
                {line}
            </Text>
        ))}
    </Stack>
)
