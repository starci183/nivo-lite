import { Alert, Button, Divider, Icon, Text, Textarea } from "@starci/grammar/common"
import { nivoIconSource } from "@/components/leaves/Icon"
import {
    COMPOSER_BODY_CLASS_NAME,
    COMPOSER_CLASS_NAME,
    COMPOSER_FIELD_CLASS_NAME,
    COMPOSER_ROW_CLASS_NAME,
} from "./classNames"

/** The composer: active only while the signed-in member holds the conversation. */
interface ChatbotComposerProps {
    readonly canReply: boolean
    readonly lockedText: string
    readonly label: string
    readonly placeholder: string
    readonly hint: string
    readonly sendLabel: string
    readonly draft: string
    readonly notSentTitle: string
    readonly error: string | null
    readonly isSending: boolean
    readonly onDraft: (draft: string) => void
    readonly onSend: () => void
}

/** The band under the thread: the reply field and its send action, or the reason the member cannot reply. */
export const ChatbotComposer = (props: ChatbotComposerProps) => (
    <div className={COMPOSER_CLASS_NAME}>
        <Divider semantics="presentation" />
        <div className={COMPOSER_BODY_CLASS_NAME}>
            {props.error === null ? null : (
                <Alert tone="negative" title={props.notSentTitle} description={props.error} />
            )}
            {props.canReply ? (
                <>
                    <div className={COMPOSER_ROW_CLASS_NAME}>
                        <div className={COMPOSER_FIELD_CLASS_NAME}>
                            <Textarea
                                label={props.label}
                                isLabelHidden
                                placeholder={props.placeholder}
                                rows={2}
                                isDisabled={props.isSending}
                                value={props.draft}
                                onValueChange={props.onDraft}
                            />
                        </div>
                        <Button
                            intent="commit"
                            isPending={props.isSending}
                            isDisabled={props.isSending || props.draft.trim().length === 0}
                            onPress={props.onSend}
                            startContent={<Icon source={nivoIconSource("send", "leading")} usage="leading" />}
                        >
                            {props.sendLabel}
                        </Button>
                    </div>
                    <Text size="xs" tone="muted">
                        {props.hint}
                    </Text>
                </>
            ) : (
                <Text size="sm" tone="muted">
                    {props.lockedText}
                </Text>
            )}
        </div>
    </div>
)
