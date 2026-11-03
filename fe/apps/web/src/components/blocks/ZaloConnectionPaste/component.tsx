import { ConnectionStepBand } from "@/components/frames/ConnectionStepBand"
import { Button, CopyField, Fieldset, Input, Grid } from "@starci/grammar/common"
import { SlotView } from "@/components/composites/SlotView"
import type { DataSlot, SlotLabels, ZaloPasteView } from "@/modules/types"

/** Fake data of the same shape: the skeleton reuses the ready tree. */
export const ZALO_PASTE_PLACEHOLDER: ZaloPasteView = {
    callbackUrl: "https://example.invalid/connections/zalo/callback",
    webhookUrl: "https://example.invalid/api/connections/zalo/00000000",
}

/** The OA Secret Key field of the step: the typed key, what is stored, and its save. */
export interface ZaloOaSecretView {
    readonly label: string
    /** Whether a key is stored, with its last four characters, or why one is needed. */
    readonly description: string
    readonly value: string
    readonly error: string
    readonly saveLabel: string
    readonly isSaving: boolean
    /** Only the owner stores a key; everyone else reads what is stored. */
    readonly canEdit: boolean
}

/** Copy, slot and commands of the second setup step: the addresses to paste into Zalo, and the key to paste back. */
export interface ZaloConnectionPasteBaseProps {
    readonly props: {
        /** The step's band: its place, words and whether it is open. */
        readonly step: {
            readonly ordinal: number
            readonly title: string
            readonly summary: string
            readonly hint: string
            readonly isOpen: boolean
        }
        /** Opens the Zalo developer site in a new tab, where the app is set up. */
        readonly openZalo: { readonly label: string; readonly href: string }
        readonly callbackLabel: string
        readonly webhookLabel: string
        readonly paste: DataSlot<ZaloPasteView>
        readonly slotLabels: SlotLabels
        readonly copyLabel: string
        readonly copiedLabel: string
        readonly copyErrorLabel: string
        readonly secret: ZaloOaSecretView
    }
    readonly on: {
        readonly toggle: (isOpen: boolean) => void
        readonly retry: () => void
        readonly changeSecret: (value: string) => void
        readonly saveSecret: () => void
    }
}

/**
 * Draws the body of the second setup step: the Official Account callback address and the webhook address, each with copy, then the
 * OA Secret Key the owner pastes back from Zalo (the back end checks every webhook signature with it).
 */
export const ZaloConnectionPasteBase = (props: ZaloConnectionPasteBaseProps) => {
    const { secret } = props.props
    return (
        <ConnectionStepBand
            {...props.props.step}
            onToggle={props.on.toggle}
            actions={
                <Button intent="neutral" href={props.props.openZalo.href} target="_blank" rel="noreferrer">
                    {props.props.openZalo.label}
                </Button>
            }
        >
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
        </ConnectionStepBand>
    )
}
