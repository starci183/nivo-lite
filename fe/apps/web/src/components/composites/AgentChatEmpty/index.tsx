import { Button, Heading, Input, Text, Cluster, Stack } from "@starci/grammar/common"
import { AgentMark } from "@/components/leaves/AgentMark"
import { EMPTY_CLASS_NAME, EMPTY_FIELD_CLASS_NAME } from "./classNames"

/** The greeting of a chat that has no conversation open yet, with the words and state it needs. */
export interface AgentChatEmptyProps {
    readonly agentName: string
    /** The picture the owner gave the agent; null draws the NIVO unicorn mascot. */
    readonly avatarUrl?: string | null | undefined
    /** The id of the agent: the one seed of its mark on every screen. */
    readonly seed: string
    readonly greeting: string
    readonly help: string
    /** The customer channel asks for a visitor name; the test channel offers prompts instead. */
    readonly isCustomer: boolean
    readonly visitorLabel: string
    readonly visitorName: string
    readonly prompts: ReadonlyArray<string>
    readonly arePromptsDisabled: boolean
    readonly startLabel: string
    readonly isStarting: boolean
    /** What happens next, one line per step (customer channel only). */
    readonly steps: ReadonlyArray<string>
    readonly onVisitorName: (value: string) => void
    readonly onPrompt: (prompt: string) => void
    readonly onStart: () => void
}

/** The empty chat: who the agent is, how to begin, and in the customer channel what will happen next. */
export const AgentChatEmpty = (props: AgentChatEmptyProps) => (
    <div className={EMPTY_CLASS_NAME}>
        <Stack gap="row" align="center">
            <AgentMark label={props.agentName} seed={props.seed} src={props.avatarUrl} size="lg" />
            <Heading level={2}>{props.greeting}</Heading>
            <Text as="p" size="sm" tone="muted">
                {props.help}
            </Text>
            {props.isCustomer ? (
                <div className={EMPTY_FIELD_CLASS_NAME}>
                    <Input
                        id="agent-chat-visitor"
                        name="visitor"
                        label={props.visitorLabel}
                        value={props.visitorName}
                        onValueChange={props.onVisitorName}
                    />
                </div>
            ) : (
                <Cluster gap="inline" justify="center">
                    {props.prompts.map((prompt) => (
                        <Button
                            key={prompt}
                            intent="neutral"
                            size="sm"
                            isDisabled={props.arePromptsDisabled}
                            onPress={() => props.onPrompt(prompt)}
                        >
                            {prompt}
                        </Button>
                    ))}
                </Cluster>
            )}
            <Button intent="commit" isPending={props.isStarting} onPress={props.onStart}>
                {props.startLabel}
            </Button>
            {props.steps.length === 0 ? null : (
                <Stack gap="inline">
                    {props.steps.map((step, index) => (
                        <Cluster key={step} gap="row" align="start">
                            <Text isStrong>{String(index + 1)}</Text>
                            <Text as="p" size="sm" tone="muted">
                                {step}
                            </Text>
                        </Cluster>
                    ))}
                </Stack>
            )}
        </Stack>
    </div>
)
