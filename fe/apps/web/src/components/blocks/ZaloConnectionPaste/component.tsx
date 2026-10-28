import { CopyField, FormGrid, SurfaceCard } from "@starci/grammar/common"
import { SlotView } from "@/components/composites/SlotView"
import type { DataSlot, SlotLabels, ZaloPasteView } from "@/modules/types"

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
        readonly copyLabel: string
        readonly copiedLabel: string
        readonly copyErrorLabel: string
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
            {(paste, isSkeleton) => (
                <FormGrid columns={2}>
                    <CopyField
                        label={props.props.callbackLabel}
                        value={paste.callbackUrl}
                        copyLabel={props.props.copyLabel}
                        copiedLabel={props.props.copiedLabel}
                        copyErrorLabel={props.props.copyErrorLabel}
                        isSkeleton={isSkeleton}
                    />
                    <CopyField
                        label={props.props.webhookLabel}
                        value={paste.webhookUrl}
                        copyLabel={props.props.copyLabel}
                        copiedLabel={props.props.copiedLabel}
                        copyErrorLabel={props.props.copyErrorLabel}
                        isSkeleton={isSkeleton}
                    />
                </FormGrid>
            )}
        </SlotView>
    </SurfaceCard>
)
