import { Alert, Button, Cluster, Form, Stack, Textarea } from "@starci/grammar/common"
import { Icon } from "@/components/leaves/Icon"
import { COMPOSER_INPUT_CLASS_NAME } from "./classNames"
import type { ChatParty } from "@/modules/teamChat"

/** The words and state of the team chat composer. */
export interface TeamChatComposerProps {
    readonly formLabel: string
    readonly messageLabel: string
    readonly placeholder: string
    readonly sendLabel: string
    readonly draft: string
    readonly isSending: boolean
    /** The first read is not in: the field draws as a waiting shape. */
    readonly isLoading: boolean
    /** Nothing is in flight and a room (or an agent to open one with) is there. */
    readonly canSend: boolean
    /** Why the last message was not sent, or null. */
    readonly error: { readonly title: string; readonly text: string } | null
    /** The people and agents the open `@` may name: empty when none is being typed. */
    readonly suggestions: ReadonlyArray<ChatParty>
    readonly onDraft: (value: string) => void
    readonly onMention: (party: ChatParty) => void
    readonly onSend: () => void
}

/** The composer pinned under the thread: an error line, the mention suggestions and the message field with its send button. */
export const TeamChatComposer = (props: TeamChatComposerProps) => (
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
            {props.suggestions.length === 0 ? null : (
                <Cluster gap="inline">
                    {props.suggestions.map((party) => (
                        <Button
                            key={`${party.kind}:${party.id}`}
                            intent="neutral"
                            size="sm"
                            startContent={<Icon props={{ name: "mention", usage: "leading" }} />}
                            onPress={() => props.onMention(party)}
                        >
                            {party.name}
                        </Button>
                    ))}
                </Cluster>
            )}
            <Cluster gap="inline" align="end" wrap={false}>
                {/* The Grammar Textarea owns Enter-to-send (Shift+Enter breaks the line). */}
                <div className={COMPOSER_INPUT_CLASS_NAME}>
                    <Textarea
                        id="team-chat-message"
                        name="message"
                        label={props.messageLabel}
                        isLabelHidden
                        rows={1}
                        isLoading={props.isLoading}
                        placeholder={props.placeholder}
                        value={props.draft}
                        onValueChange={props.onDraft}
                        onSubmitShortcut={() => {
                            if (props.canSend && props.draft.trim() !== "") props.onSend()
                        }}
                    />
                </div>
                <Button
                    type="submit"
                    intent="commit"
                    isPending={props.isSending}
                    isDisabled={!props.canSend}
                    startContent={<Icon props={{ name: "send", usage: "leading" }} />}
                >
                    {props.sendLabel}
                </Button>
            </Cluster>
        </Stack>
    </Form>
)
