import { Alert, Button, Fieldset, Input, Select, Text } from "@starci/grammar/common"
import type { ZaloSendView } from "@/modules/types"

/** Copy, the resolved send view, form state and commands of the test send. */
export interface ZaloTestSendProps {
    readonly props: {
        readonly title: string
        readonly hint: string
        /** The followers inside the 48 hours and why a send is closed, from the block's SlotView. */
        readonly view: ZaloSendView
        readonly isLoading: boolean
        readonly recipientLabel: string
        readonly recipientEmpty: string
        readonly recipientId: string
        readonly textLabel: string
        readonly text: string
        readonly sendLabel: string
        readonly isSending: boolean
        /** The outcome of the last send; empty when none. */
        readonly note: string
        readonly noteTone: "affirmative" | "negative"
    }
    readonly on: {
        readonly pickRecipient: (id: string) => void
        readonly changeText: (text: string) => void
        readonly send: () => void
    }
}

/**
 * Draws the test send inside the fourth setup step: the followers inside the 48 hours, the text, and a send that stays closed with its
 * reason (a field group of its own, under the check list).
 */
export const ZaloTestSend = (props: ZaloTestSendProps) => (
    <Fieldset
        legend={props.props.title}
        description={props.props.hint}
        actions={
            <Button
                intent="neutral"
                isLoading={props.props.isLoading}
                isPending={props.props.isSending}
                isDisabled={
                    props.props.view.blocked !== "" || props.props.recipientId === "" || props.props.text.trim() === ""
                }
                onPress={props.on.send}
            >
                {props.props.sendLabel}
            </Button>
        }
    >
        <Select
            label={props.props.recipientLabel}
            placeholder={props.props.recipientEmpty}
            options={props.props.view.options.map((option) => ({ id: option.id, label: option.label }))}
            value={props.props.recipientId}
            isDisabled={props.props.view.options.length === 0}
            isLoading={props.props.isLoading}
            onValueChange={(value) => props.on.pickRecipient(value ?? "")}
        />
        <Input
            id="zalo-test-text"
            name="text"
            label={props.props.textLabel}
            value={props.props.text}
            isLoading={props.props.isLoading}
            onValueChange={props.on.changeText}
        />
        {props.props.view.blocked === "" ? null : (
            <Text size="sm" tone="muted">
                {props.props.view.blocked}
            </Text>
        )}
        {props.props.note === "" ? null : <Alert tone={props.props.noteTone} title={props.props.note} />}
    </Fieldset>
)
