import { Button, Text, Textarea } from "@starci/grammar/common"
import type { ComposerOption } from "@/modules/types"
import { COMPOSER_CLASS_NAME, FIELD_CLASS_NAME, ROW_CLASS_NAME } from "./classNames"

/** The words and state of the composer. */
type ThreadComposerProps = {
    readonly label: string
    readonly placeholder: string
    readonly hint: string
    readonly mentionLabel: string
    readonly sendLabel: string
    readonly draft: string
    /** The people, agents and groups the at sign offers. */
    readonly options: ReadonlyArray<ComposerOption>
    readonly isSending: boolean
    /** No thread is open: the field waits. */
    readonly isDisabled: boolean
    readonly onDraft: (value: string) => void
    readonly onPick: (option: ComposerOption) => void
    readonly onSend: () => void
}

/** The composer under the thread: the field with its at-sign list of people, agents and groups, and Send. */
export const ThreadComposer = (props: ThreadComposerProps) => {
    const canSend = !props.isDisabled && props.draft.trim().length > 0
    return (
        <div className={COMPOSER_CLASS_NAME}>
            <div className={ROW_CLASS_NAME}>
                <div className={FIELD_CLASS_NAME}>
                    <Textarea
                        id="thread-message"
                        label={props.label}
                        isLabelHidden
                        variant="secondary"
                        rows={1}
                        isDisabled={props.isDisabled}
                        placeholder={props.placeholder}
                        value={props.draft}
                        onValueChange={props.onDraft}
                        onSubmitShortcut={() => {
                            if (canSend) props.onSend()
                        }}
                        mentions={{ options: props.options, label: props.mentionLabel, onSelect: props.onPick }}
                    />
                </div>
                <Button variant="primary" isPending={props.isSending} isDisabled={!canSend} onPress={props.onSend}>
                    {props.sendLabel}
                </Button>
            </div>
            <Text size="xs" tone="muted">
                {props.hint}
            </Text>
        </div>
    )
}
