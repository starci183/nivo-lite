import { Alert, Button, Fieldset, Input, Select, Text } from "@starci/grammar/common"
import { SlotView } from "@/components/composites/SlotView"
import type { DataSlot, SlotLabels, ZaloSendView } from "@/modules/types"

/** Fake data of the same shape: the skeleton reuses the ready tree. */
export const ZALO_SEND_PLACEHOLDER: ZaloSendView = { options: [], blocked: "" }

/** Copy, slot, form state and commands of the test send. */
export interface ZaloConnectionTestSendBaseProps {
    readonly props: {
        readonly title: string
        readonly hint: string
        readonly send: DataSlot<ZaloSendView>
        readonly slotLabels: SlotLabels
        readonly recipientLabel: string
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
        readonly retry: () => void
    }
}

/**
 * Draws the test send inside the fourth setup step: the followers inside the 48 hours, the text, and a send that stays closed with its
 * reason (a field group of its own, under the check list).
 */
export const ZaloConnectionTestSendBase = (props: ZaloConnectionTestSendBaseProps) => (
    <SlotView
        slot={props.props.send}
        placeholder={ZALO_SEND_PLACEHOLDER}
        labels={props.props.slotLabels}
        onRetry={props.on.retry}
    >
        {(view, isSkeleton) => (
            <Fieldset
                legend={props.props.title}
                description={props.props.hint}
                actions={
                    <Button
                        intent="neutral"
                        isSkeleton={isSkeleton}
                        isPending={props.props.isSending}
                        isDisabled={
                            view.blocked !== "" || props.props.recipientId === "" || props.props.text.trim() === ""
                        }
                        onPress={props.on.send}
                    >
                        {props.props.sendLabel}
                    </Button>
                }
            >
                <Select
                    label={props.props.recipientLabel}
                    options={view.options.map((option) => ({ id: option.id, label: option.label }))}
                    value={props.props.recipientId}
                    isDisabled={view.options.length === 0}
                    isSkeleton={isSkeleton}
                    onValueChange={(value) => props.on.pickRecipient(value ?? "")}
                />
                <Input
                    id="zalo-test-text"
                    name="text"
                    label={props.props.textLabel}
                    value={props.props.text}
                    isSkeleton={isSkeleton}
                    onValueChange={props.on.changeText}
                />
                {view.blocked === "" ? null : (
                    <Text size="sm" tone="muted">
                        {view.blocked}
                    </Text>
                )}
                {props.props.note === "" ? null : (
                    <Alert tone={props.props.noteTone} appearance="soft" title={props.props.note} />
                )}
            </Fieldset>
        )}
    </SlotView>
)
