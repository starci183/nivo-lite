import { Alert, Button, Input, Select, SurfaceCard, Text } from "@starci/grammar/common"
import { SlotView } from "@/components/composites/SlotView"
import type { DataSlot, SlotLabels, ZaloSendView } from "@/modules/types"
import { FIELDS } from "./classNames"

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

/** Draws the test send: the followers inside the 48 hours, the text, and a send that stays closed with its reason. */
export const ZaloConnectionTestSendBase = (props: ZaloConnectionTestSendBaseProps) => (
    <SurfaceCard label={props.props.title} headingLevel={2}>
        <SlotView
            slot={props.props.send}
            placeholder={ZALO_SEND_PLACEHOLDER}
            labels={props.props.slotLabels}
            onRetry={props.on.retry}
        >
            {(view, isSkeleton) => (
                <div className={FIELDS}>
                    <Text size="sm" tone="muted">
                        {props.props.hint}
                    </Text>
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
                    <Button
                        intent="commit"
                        isSkeleton={isSkeleton}
                        isPending={props.props.isSending}
                        isDisabled={
                            view.blocked !== "" || props.props.recipientId === "" || props.props.text.trim() === ""
                        }
                        onPress={props.on.send}
                    >
                        {props.props.sendLabel}
                    </Button>
                    {view.blocked === "" ? null : (
                        <Text size="sm" tone="muted">
                            {view.blocked}
                        </Text>
                    )}
                    {props.props.note === "" ? null : <Alert tone={props.props.noteTone} title={props.props.note} />}
                </div>
            )}
        </SlotView>
    </SurfaceCard>
)
