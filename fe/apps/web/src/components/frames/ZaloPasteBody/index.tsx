import { CopyField, Fieldset, Grid, Input, Button } from "@starci/grammar/common"
import { SlotView } from "@nivo-lite/agent-sdk/client"
import type { DataSlot, SlotLabels, ZaloPasteView } from "@/modules/types"

/** Fake data of the same shape: the skeleton reuses the ready tree. */
const ZALO_PASTE_PLACEHOLDER: ZaloPasteView = {
    callbackUrl: "https://example.invalid/connections/zalo/callback",
    webhookUrl: "https://example.invalid/api/connections/zalo/00000000",
}

/** Copy, slot and commands of the body of the second setup step: the addresses to paste into Zalo, and the key to paste back. */
export interface ZaloPasteBodyProps {
    readonly props: {
        readonly callbackLabel: string
        readonly webhookLabel: string
        readonly paste: DataSlot<ZaloPasteView>
        readonly slotLabels: SlotLabels
        readonly copyLabel: string
        readonly copiedLabel: string
        readonly copyErrorLabel: string
        /** The OA Secret Key field: the typed key, what is stored, and its save. */
        readonly secret: {
            readonly label: string
            readonly description: string
            readonly value: string
            readonly error: string
            readonly saveLabel: string
            readonly isSaving: boolean
            /** Only the owner stores a key; everyone else reads what is stored. */
            readonly canEdit: boolean
        }
    }
    readonly on: {
        readonly retry: () => void
        readonly changeSecret: (value: string) => void
        readonly saveSecret: () => void
    }
}

/**
 * Draws the body of the second setup step: the Official Account callback address and the webhook address, each with copy, then the
 * OA Secret Key the owner pastes back from Zalo (the back end checks every webhook signature with it).
 */
export const ZaloPasteBody = (props: ZaloPasteBodyProps) => {
    const { secret } = props.props
    return (
        <SlotView
            slot={props.props.paste}
            placeholder={ZALO_PASTE_PLACEHOLDER}
            labels={props.props.slotLabels}
            onRetry={props.on.retry}
            render={(paste, isLoading) => (
                <>
                    <Grid kind="form" columns={2}>
                        <CopyField
                            label={props.props.callbackLabel}
                            value={paste.callbackUrl}
                            copyLabel={props.props.copyLabel}
                            copiedLabel={props.props.copiedLabel}
                            copyErrorLabel={props.props.copyErrorLabel}
                            isLoading={isLoading}
                        />
                        <CopyField
                            label={props.props.webhookLabel}
                            value={paste.webhookUrl}
                            copyLabel={props.props.copyLabel}
                            copiedLabel={props.props.copiedLabel}
                            copyErrorLabel={props.props.copyErrorLabel}
                            isLoading={isLoading}
                        />
                    </Grid>
                    <Fieldset
                        legend={secret.label}
                        isLegendHidden
                        actions={
                            secret.canEdit ? (
                                <Button
                                    intent="neutral"
                                    isPending={secret.isSaving}
                                    isDisabled={isLoading}
                                    onPress={props.on.saveSecret}
                                >
                                    {secret.saveLabel}
                                </Button>
                            ) : undefined
                        }
                    >
                        <Input
                            id="zalo-oa-secret"
                            name="oaSecret"
                            kind="password"
                            label={secret.label}
                            description={secret.description}
                            value={secret.value}
                            isDisabled={!secret.canEdit}
                            isLoading={isLoading}
                            isInvalid={secret.error !== ""}
                            errorMessage={secret.error}
                            onValueChange={props.on.changeSecret}
                        />
                    </Fieldset>
                </>
            )}
        />
    )
}
