import { Alert, Button, Form, Textarea } from "@starci/grammar/common"
import { CHIPS_CLASS_NAME, COMPOSER_CLASS_NAME, COMPOSER_INPUT_CLASS_NAME, COMPOSER_ROW_CLASS_NAME } from "./classNames"

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
    <div className={COMPOSER_CLASS_NAME}>
        <Form
            label={props.formLabel}
            isPending={props.isSending}
            onSubmit={(_data, event) => {
                event.preventDefault()
                if (props.canSend) props.onSend()
            }}
        >
            {props.error === null ? null : (
                <Alert tone="negative" title={props.error.title} description={props.error.text} />
            )}
            {props.prompts.length === 0 ? null : (
                <div className={CHIPS_CLASS_NAME}>
                    {props.prompts.map((prompt) => (
                        <Button
                            key={prompt}
                            variant="outline"
                            size="sm"
                            isDisabled={props.isSending}
                            onPress={() => props.onPrompt(prompt)}
                        >
                            {prompt}
                        </Button>
                    ))}
                </div>
            )}
            <div className={COMPOSER_ROW_CLASS_NAME}>
                {/* The Grammar Textarea owns Enter-to-send (Shift+Enter breaks the line). */}
                <div className={COMPOSER_INPUT_CLASS_NAME}>
                    <Textarea
                        id="agent-chat-message"
                        name="message"
                        label={props.messageLabel}
                        isLabelHidden
                        variant="secondary"
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
                <Button type="submit" variant="primary" isPending={props.isSending} isDisabled={!props.canSend}>
                    {props.sendLabel}
                </Button>
            </div>
        </Form>
    </div>
)
