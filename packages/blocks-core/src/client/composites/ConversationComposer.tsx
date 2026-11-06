import type { ReactNode } from "react"
import { Button, Cluster, Form, PaneSection, Textarea } from "@starci/grammar/common"

/** The words and state of the composer. */
interface ConversationComposerProps {
    /** The accessible name of the field and of the form. */
    readonly label: string
    readonly placeholder: string
    readonly sendLabel: string
    /** Why the viewer cannot reply; null when they can. */
    readonly lockedText: string | null
    readonly draft: string
    readonly maxLength: number
    /** Why the draft cannot be sent while it is not empty; null when nothing is wrong with it. */
    readonly problem: string | null
    /** Whether a send is running: the control shows a spinner. */
    readonly isSending: boolean
    /** Whether the send control works. */
    readonly canSend: boolean
    readonly onDraft: (draft: string) => void
    readonly onSend: () => void
}

/** The band under the thread: the reply field with its send control, or the reason the viewer cannot reply. */
export const ConversationComposer = (props: ConversationComposerProps): ReactNode => {
    const isLocked = props.lockedText !== null
    return (
        <PaneSection>
            <Form
                label={props.label}
                isPending={props.isSending}
                onSubmit={(_data, event) => {
                    event.preventDefault()
                    if (props.canSend) props.onSend()
                }}
            >
                <Cluster gap="inline" align="end" wrap={false}>
                    <Textarea
                        name="message"
                        label={props.label}
                        isLabelHidden
                        rows={1}
                        isDisabled={isLocked}
                        placeholder={props.lockedText ?? props.placeholder}
                        value={props.draft}
                        maxLength={props.maxLength}
                        onValueChange={props.onDraft}
                        {...(props.problem === null ? {} : { errorMessage: props.problem })}
                        onSubmitShortcut={() => {
                            if (props.canSend) props.onSend()
                        }}
                    />
                    <Button
                        type="submit"
                        intent="commit"
                        isPending={props.isSending}
                        isDisabled={isLocked || !props.canSend}
                    >
                        {props.sendLabel}
                    </Button>
                </Cluster>
            </Form>
        </PaneSection>
    )
}
