import { CopyField } from "@starci/grammar/common"
import { SlotView } from "@/components/composites/SlotView"
import type { DataSlot, SlotLabels } from "@/modules/types"

/** Fake data of the same shape: the skeleton reuses the ready tree. */
const WEBHOOK_PLACEHOLDER = "https://example.invalid/api/telegram/00000000"

/** Copy and slot of the webhook step. */
export interface TelegramConnectionWebhookBaseProps {
    readonly props: {
        readonly label: string
        readonly description: string
        readonly url: DataSlot<string>
        readonly slotLabels: SlotLabels
        readonly copyLabel: string
        readonly copiedLabel: string
        readonly copyErrorLabel: string
    }
    readonly on: { readonly retry: () => void }
}

/** Draws the body of the webhook step: the address NIVO registered with Telegram, to read and copy (nothing is pasted anywhere). */
export const TelegramConnectionWebhookBase = (props: TelegramConnectionWebhookBaseProps) => (
    <SlotView
        slot={props.props.url}
        placeholder={WEBHOOK_PLACEHOLDER}
        labels={props.props.slotLabels}
        onRetry={props.on.retry}
    >
        {(url, isSkeleton) => (
            <CopyField
                label={props.props.label}
                description={props.props.description}
                value={url}
                copyLabel={props.props.copyLabel}
                copiedLabel={props.props.copiedLabel}
                copyErrorLabel={props.props.copyErrorLabel}
                isSkeleton={isSkeleton}
            />
        )}
    </SlotView>
)
