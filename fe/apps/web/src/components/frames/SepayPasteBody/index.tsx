import { Button, CopyField, DescriptionList, Fieldset, Grid, Text } from "@starci/grammar/common"
import { SlotView } from "@nivo-lite/agent-sdk/client"
import { SepayConfirm } from "@/components/composites/SepayConfirm"
import type { DataSlot, SlotLabels } from "@/modules/types"

/** What the third step shows once the connection is read. */
interface SepayPasteView {
    readonly webhookUrl: string
    readonly apiKeyMasked: string
}

/** Copy, slot and commands of the body of the third setup step: what to create on SePay. */
export interface SepayPasteBodyProps {
    readonly props: {
        readonly slot: DataSlot<SepayPasteView>
        readonly placeholder: SepayPasteView
        readonly labels: SlotLabels
        readonly copyLabel: string
        readonly copiedLabel: string
        readonly copyErrorLabel: string
        readonly webhookLabel: string
        readonly keyLabel: string
        /** The header SePay sends back, and what a new key does to the old one. */
        readonly keyNote: string
        /** The settings of the webhook form on SePay, each with the value to pick. */
        readonly settingsLabel: string
        readonly settings: ReadonlyArray<{ readonly id: string; readonly label: string; readonly value: string }>
        readonly canEdit: boolean
        /** The new-key command: its button and the confirmation that warns the old key stops working. */
        readonly rotate: {
            readonly label: string
            readonly isOpen: boolean
            readonly title: string
            readonly description: string
            readonly confirmLabel: string
            readonly cancelLabel: string
            readonly isPending: boolean
        }
    }
    readonly on: {
        readonly retry: () => void
        readonly askRotate: () => void
        readonly confirmRotate: () => void
        readonly dismissRotate: () => void
        /** Reveals the clear key for the clipboard only; rejects when the reveal fails. */
        readonly copyKey: () => Promise<string>
    }
}

/** What to paste into SePay: the address and the key, each with copy, the new-key command, and the settings to pick. */
export const SepayPasteBody = (props: SepayPasteBodyProps) => {
    const view = props.props
    return (
        <>
            <SlotView
                slot={view.slot}
                placeholder={view.placeholder}
                labels={view.labels}
                onRetry={props.on.retry}
                render={(setup, isLoading) => (
                    <>
                        <Fieldset
                            legend={view.keyLabel}
                            isLegendHidden
                            actions={
                                view.canEdit ? (
                                    <Button intent="neutral" isDisabled={isLoading} onPress={props.on.askRotate}>
                                        {view.rotate.label}
                                    </Button>
                                ) : undefined
                            }
                        >
                            <Grid kind="form" columns={2}>
                                <CopyField
                                    label={view.webhookLabel}
                                    value={setup.webhookUrl}
                                    copyLabel={view.copyLabel}
                                    copiedLabel={view.copiedLabel}
                                    copyErrorLabel={view.copyErrorLabel}
                                    isLoading={isLoading}
                                />
                                <CopyField
                                    masked
                                    label={view.keyLabel}
                                    description={view.keyNote}
                                    lastFour={setup.apiKeyMasked.slice(-4)}
                                    onCopy={props.on.copyKey}
                                    copyLabel={view.copyLabel}
                                    copiedLabel={view.copiedLabel}
                                    copyErrorLabel={view.copyErrorLabel}
                                    isDisabled={!view.canEdit}
                                    isLoading={isLoading}
                                />
                            </Grid>
                        </Fieldset>
                        <Fieldset legend={view.settingsLabel}>
                            <DescriptionList
                                layout="columns"
                                isLoading={isLoading}
                                items={view.settings.map((setting) => ({
                                    id: setting.id,
                                    term: setting.label,
                                    description: <Text isStrong>{setting.value}</Text>,
                                }))}
                            />
                        </Fieldset>
                    </>
                )}
            />
            <SepayConfirm
                isOpen={view.rotate.isOpen}
                title={view.rotate.title}
                description={view.rotate.description}
                confirmLabel={view.rotate.confirmLabel}
                cancelLabel={view.rotate.cancelLabel}
                isPending={view.rotate.isPending}
                onConfirm={props.on.confirmRotate}
                onDismiss={props.on.dismissRotate}
            />
        </>
    )
}
