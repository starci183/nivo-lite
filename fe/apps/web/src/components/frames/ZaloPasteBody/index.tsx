import { CopyField, Grid } from "@starci/grammar/common"
import { SlotView } from "@nivo-lite/agent-sdk/client"
import type { DataSlot, SlotLabels, ZaloPasteView } from "@/modules/types"

/** Fake data of the same shape: the skeleton reuses the ready tree. */
const ZALO_PASTE_PLACEHOLDER: ZaloPasteView = {
    callbackUrl: "https://example.invalid/connections/zalo/callback",
}

/** Copy, slot and commands of the body of the second setup step: the callback address to paste into Zalo. */
export interface ZaloPasteBodyProps {
    readonly props: {
        readonly callbackLabel: string
        readonly paste: DataSlot<ZaloPasteView>
        readonly slotLabels: SlotLabels
        readonly copyLabel: string
        readonly copiedLabel: string
        readonly copyErrorLabel: string
    }
    readonly on: {
        readonly retry: () => void
    }
}

/**
 * Draws the body of the second setup step: the Official Account callback address, with copy. It is the one address of this step that
 * belongs to the workspace and not to the connection; the webhook address and the OA Secret Key are fields of the form.
 */
export const ZaloPasteBody = (props: ZaloPasteBodyProps) => {
    return (
        <SlotView
            slot={props.props.paste}
            placeholder={ZALO_PASTE_PLACEHOLDER}
            labels={props.props.slotLabels}
            onRetry={props.on.retry}
            render={(paste, isLoading) => (
                <Grid kind="form" columns={1}>
                        <CopyField
                            label={props.props.callbackLabel}
                            value={paste.callbackUrl}
                            copyLabel={props.props.copyLabel}
                            copiedLabel={props.props.copiedLabel}
                            copyErrorLabel={props.props.copyErrorLabel}
                            isLoading={isLoading}
                        />
                    </Grid>
            )}
        />
    )
}
