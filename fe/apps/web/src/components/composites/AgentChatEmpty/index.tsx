import { nivoIconSource } from "@/components/leaves/Icon"
import type { ModuleIconName } from "@/modules/types"
import { Button, Input, Text } from "@starci/grammar/common"
import { AgentMark } from "@/components/leaves/AgentMark"
import {
    EMPTY_CHIPS_CLASS_NAME,
    EMPTY_CLASS_NAME,
    EMPTY_FIELD_CLASS_NAME,
    STEP_LIST_CLASS_NAME,
    STEP_ROW_CLASS_NAME,
} from "./classNames"

/** The greeting of a chat that has no conversation open yet, with the words and state it needs. */
export interface AgentChatEmptyProps {
    readonly agentName: string
    readonly glyph: ModuleIconName
    readonly module: string
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
        <AgentMark
            glyph={nivoIconSource(props.glyph, "leading")}
            module={props.module}
            label={props.agentName}
            size="lg"
        />
        <Text weight="semibold">{props.greeting}</Text>
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
            <div className={EMPTY_CHIPS_CLASS_NAME}>
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
            </div>
        )}
        <Button intent="commit" isPending={props.isStarting} onPress={props.onStart}>
            {props.startLabel}
        </Button>
        {props.steps.length === 0 ? null : (
            <div className={STEP_LIST_CLASS_NAME}>
                {props.steps.map((step, index) => (
                    <div key={step} className={STEP_ROW_CLASS_NAME}>
                        <Text weight="semibold">{String(index + 1)}</Text>
                        <Text as="p" size="sm" tone="muted">
                            {step}
                        </Text>
                    </div>
                ))}
            </div>
        )}
    </div>
)
