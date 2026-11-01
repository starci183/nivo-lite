import { Stack, Text, TextAction } from "@starci/grammar/common"

/** The connections an agent waits for, already in the reader language, and where to connect them. */
export interface ConnectionNeedsProps {
    /** One line per missing role, e.g. the providers that would satisfy it; empty when nothing is missing. */
    readonly lines: ReadonlyArray<string>
    readonly linkLabel: string
    readonly href: string
}

/** What a `needs_connection` agent waits for, with a link to Settings, Connections; nothing when it waits for nothing. */
export const ConnectionNeeds = (props: ConnectionNeedsProps) =>
    props.lines.length === 0 ? null : (
        <Stack gap="identity">
            {props.lines.map((line) => (
                <Text key={line} size="xs" tone="muted">
                    {line}
                </Text>
            ))}
            <TextAction size="xs" href={props.href}>
                {props.linkLabel}
            </TextAction>
        </Stack>
    )
