import { SurfaceCard } from "@starci/grammar/common"
import { ConnectionCopyInput } from "@/components/composites/ConnectionCopyInput"
import { SlotView } from "@/components/composites/SlotView"
import type { DataSlot, RowCopyLabels, SlotLabels, ZaloPasteView } from "@/modules/types"
import { FIELDS } from "./classNames"

/** Fake data of the same shape: the skeleton reuses the ready tree. */
export const ZALO_PASTE_PLACEHOLDER: ZaloPasteView = {
    callbackUrl: "https://example.invalid/connections/zalo/callback",
    webhookUrl: "https://example.invalid/api/connections/zalo/00000000",
}

/** Copy and slot of the addresses to paste into Zalo. */
export interface ZaloConnectionPasteBaseProps {
    readonly props: {
        readonly title: string
        readonly callbackLabel: string
        readonly webhookLabel: string
        readonly paste: DataSlot<ZaloPasteView>
        readonly slotLabels: SlotLabels
        readonly copyLabels: RowCopyLabels
    }
    readonly on: { readonly retry: () => void }
}

/** Draws the details to paste into Zalo: the Official Account callback address and the webhook address, each with copy. */
export const ZaloConnectionPasteBase = (props: ZaloConnectionPasteBaseProps) => (
    <SurfaceCard label={props.props.title} headingLevel={2}>
        <SlotView
            slot={props.props.paste}
            placeholder={ZALO_PASTE_PLACEHOLDER}
            labels={props.props.slotLabels}
            onRetry={props.on.retry}
        >
            {(paste) => (
                <div className={FIELDS}>
                    <ConnectionCopyInput
                        id="zalo-callback-url"
                        name="callbackUrl"
                        label={props.props.callbackLabel}
                        value={paste.callbackUrl}
                        labels={props.props.copyLabels}
                    />
                    <ConnectionCopyInput
                        id="zalo-webhook-url"
                        name="webhookUrl"
                        label={props.props.webhookLabel}
                        value={paste.webhookUrl}
                        labels={props.props.copyLabels}
                    />
                </div>
            )}
        </SlotView>
    </SurfaceCard>
)
