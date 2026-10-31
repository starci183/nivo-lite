import { Alert, Button, Cluster, Form, Stack, Textarea } from "@starci/grammar/common"
import { COMPOSER_INPUT_CLASS_NAME } from "./classNames"

/** The words and state of the message composer. */
export interface AgentChatComposerProps {
    readonly formLabel: string
    readonly messageLabel: string
    readonly placeholder: string
    readonly sendLabel: string
    readonly draft: string
    readonly isSending: boolean
    /** The agent is still loading: the field draws as a waiting shape. */
    readonly isSkeleton: boolean
    readonly canSend: boolean
    /** Why the last message was not sent, or null. */
    readonly error: { readonly title: string; readonly text: string } | null
    /** The prompts offered above the field; empty when none are. */
    readonly prompts: ReadonlyArray<string>
    readonly onDraft: (value: string) => void
    readonly onPrompt: (prompt: string) => void
    readonly onSend: () => void
}

/** The composer pinned at the bottom of the chat: an error line, prompt chips and the message field with its send button. */
export const AgentChatComposer = (props: AgentChatComposerProps) => (
    <Form
        label={props.formLabel}
        isPending={props.isSending}
        onSubmit={(_data, event) => {
            event.preventDefault()
            if (props.canSend) props.onSend()
        }}
    >
        <Stack gap="inline">
            {props.error === null ? null : (
                <Alert tone="negative" title={props.error.title} description={props.error.text} />
            )}
            {props.prompts.length === 0 ? null : (
                <Cluster gap="inline">
                    {props.prompts.map((prompt) => (
                        <Button
                            key={prompt}
                            intent="neutral"
                            size="sm"
                            isDisabled={props.isSending}
                            onPress={() => props.onPrompt(prompt)}
                        >
                            {prompt}
                        </Button>
                    ))}
                </Cluster>
            )}
            <Cluster gap="inline" align="end" wrap={false}>
                {/* The Grammar Textarea owns Enter-to-send (Shift+Enter breaks the line). */}
                <div className={COMPOSER_INPUT_CLASS_NAME}>
                    <Textarea
                        id="agent-chat-message"
                        name="message"
                        label={props.messageLabel}
                        isLabelHidden
                        rows={1}
                        isSkeleton={props.isSkeleton}
                        placeholder={props.placeholder}
                        value={props.draft}
                        onValueChange={props.onDraft}
                        onSubmitShortcut={() => {
                            if (props.canSend) props.onSend()
                        }}
                    />
                </div>
                <Button type="submit" intent="commit" isPending={props.isSending} isDisabled={!props.canSend}>
                    {props.sendLabel}
                </Button>
            </Cluster>
        </Stack>
    </Form>
)
