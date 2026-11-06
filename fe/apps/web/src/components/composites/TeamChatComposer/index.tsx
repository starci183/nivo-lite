import { Alert, Button, Cluster, Form, Stack, Text, Textarea } from "@starci/grammar/common"
import { ChatFileChosen } from "@/components/branches/ChatFileChosen"
import { ChatFilePicker } from "@/components/branches/ChatFilePicker"
import { Icon } from "@/components/leaves/Icon"
import { COMPOSER_INPUT_CLASS_NAME } from "./classNames"
import type { TeamChatComposerProps } from "@/modules/types"

/** The glyph before a mention suggestion. */
const MENTION_ICON = <Icon props={{ name: "mention", usage: "leading" }} />

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
                            startContent={MENTION_ICON}
                            onPress={() => props.onMention(party)}
                        >
                            {party.name}
                        </Button>
                    ))}
                </Cluster>
            )}
            {props.typing === null ? null : (
                <Text size="xs" tone="muted" live="polite">
                    {props.typing}
                </Text>
            )}
            {props.file.name === null ? null : (
                <ChatFileChosen
                    name={props.file.name}
                    removeLabel={props.file.removeLabel}
                    isDisabled={props.isSending}
                    onRemove={props.onFileClear}
                />
            )}
            <Cluster gap="inline" align="end" wrap={false}>
                <ChatFilePicker
                    label={props.file.label}
                    accept={props.file.accept}
                    isDisabled={props.isSending || props.isLoading || !props.file.canPick}
                    onFile={props.onFile}
                />
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
                            if (props.canSend && (props.draft.trim() !== "" || props.file.name !== null)) props.onSend()
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
