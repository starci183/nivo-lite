import { Button, CopyField, DescriptionList, Fieldset, FormGrid, Input, Select, Text } from "@starci/grammar/common"
import { SepayConfirm } from "@/components/composites/SepayConfirm"
import { SlotView } from "@/components/composites/SlotView"
import type { DataSlot, SepayAccountForm, SlotLabels } from "@/modules/types"

/** What the setup tab shows once the connection is read. */
export interface SepaySetupView {
    readonly webhookUrl: string
    readonly apiKeyMasked: string
    readonly accountHint: string
}

/** The new-key command: its button and the confirmation that warns the old key stops working. */
export interface SepayRotateView {
    readonly label: string
    readonly isOpen: boolean
    readonly title: string
    readonly description: string
    readonly confirmLabel: string
    readonly cancelLabel: string
    readonly isPending: boolean
}

/** Props for {@link SepaySetupBase}. */
export interface SepaySetupBaseProps {
    /** `paste`: what to do on SePay (the third setup step); `account`: the bank account (the second). */
    readonly shape: "paste" | "account"
    readonly props: {
        readonly slot: DataSlot<SepaySetupView>
        readonly placeholder: SepaySetupView
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
        readonly accountTitle: string
        readonly bankLabel: string
        readonly bankPlaceholder: string
        readonly bankOptions: ReadonlyArray<{ readonly id: string; readonly label: string }>
        readonly accountLabel: string
        readonly holderLabel: string
        readonly saveLabel: string
        readonly form: SepayAccountForm
        readonly canEdit: boolean
        readonly isPending: boolean
        readonly rotate: SepayRotateView
    }
    readonly on: {
        readonly retry: () => void
        readonly askRotate: () => void
        readonly confirmRotate: () => void
        readonly dismissRotate: () => void
        /** Reveals the clear key for the clipboard only; rejects when the reveal fails. */
        readonly copyKey: () => Promise<string>
        readonly bank: (bank: string) => void
        readonly account: (account: string) => void
        readonly holder: (holder: string) => void
        readonly save: () => void
    }
}

type PartProps = {
    readonly base: SepaySetupBaseProps
    readonly setup: SepaySetupView
    readonly isSkeleton: boolean
}

/** What to paste into SePay: the address and the key, each with copy, the new-key command, and the settings to pick. */
const PastePart = ({ base, setup, isSkeleton }: PartProps) => (
    <>
        <Fieldset
            legend={base.props.keyLabel}
            isLegendHidden
            actions={
                base.props.canEdit ? (
                    <Button intent="neutral" isDisabled={isSkeleton} onPress={base.on.askRotate}>
                        {base.props.rotate.label}
                    </Button>
                ) : undefined
            }
        >
            <FormGrid columns={2}>
                <CopyField
                    label={base.props.webhookLabel}
                    value={setup.webhookUrl}
                    copyLabel={base.props.copyLabel}
                    copiedLabel={base.props.copiedLabel}
                    copyErrorLabel={base.props.copyErrorLabel}
                    isSkeleton={isSkeleton}
                />
                <CopyField
                    masked
                    label={base.props.keyLabel}
                    description={base.props.keyNote}
                    lastFour={setup.apiKeyMasked.slice(-4)}
                    onCopy={base.on.copyKey}
                    copyLabel={base.props.copyLabel}
                    copiedLabel={base.props.copiedLabel}
                    copyErrorLabel={base.props.copyErrorLabel}
                    isDisabled={!base.props.canEdit}
                    isSkeleton={isSkeleton}
                />
            </FormGrid>
        </Fieldset>
        <Fieldset legend={base.props.settingsLabel}>
            <DescriptionList
                layout="columns"
                isLoading={isSkeleton}
                items={base.props.settings.map((setting) => ({
                    id: setting.id,
                    term: setting.label,
                    description: <Text weight="medium">{setting.value}</Text>,
                }))}
            />
        </Fieldset>
    </>
)

/** The bank account whose full number a VietQR needs; the stored number is kept when the field is left empty. */
const AccountPart = ({ base, setup, isSkeleton }: PartProps) => {
    const { props: view, on } = base
    const isLocked = !view.canEdit || view.isPending
    return (
        <Fieldset
            legend={view.accountTitle}
            isLegendHidden
            actions={
                view.canEdit ? (
                    <Button intent="neutral" isPending={view.isPending} isDisabled={isSkeleton} onPress={on.save}>
                        {view.saveLabel}
                    </Button>
                ) : undefined
            }
        >
            <FormGrid columns={2}>
                <Select
                    label={view.bankLabel}
                    placeholder={view.bankPlaceholder}
                    isDisabled={isLocked}
                    value={view.form.bank === "" ? null : view.form.bank}
                    options={[...view.bankOptions]}
                    onValueChange={(value) => on.bank(value ?? "")}
                />
                <Input
                    id="sepay-account"
                    name="account"
                    label={view.accountLabel}
                    description={setup.accountHint}
                    isDisabled={isLocked}
                    isSkeleton={isSkeleton}
                    value={view.form.account}
                    onValueChange={on.account}
                />
                <Input
                    id="sepay-holder"
                    name="holder"
                    label={view.holderLabel}
                    isDisabled={isLocked}
                    isSkeleton={isSkeleton}
                    value={view.form.holder}
                    onValueChange={on.holder}
                />
            </FormGrid>
        </Fieldset>
    )
}

/**
 * Draws one part of the SePay setup inside its step: what to do on SePay (with the confirmation a new key asks for), or the bank
 * account.
 */
export const SepaySetupBase = (props: SepaySetupBaseProps) => (
    <>
        <SlotView
            slot={props.props.slot}
            placeholder={props.props.placeholder}
            labels={props.props.labels}
            onRetry={props.on.retry}
        >
            {(setup, isSkeleton) =>
                props.shape === "paste" ? (
                    <PastePart base={props} setup={setup} isSkeleton={isSkeleton} />
                ) : (
                    <AccountPart base={props} setup={setup} isSkeleton={isSkeleton} />
                )
            }
        </SlotView>
        {props.shape === "paste" ? (
            <SepayConfirm
                isOpen={props.props.rotate.isOpen}
                title={props.props.rotate.title}
                description={props.props.rotate.description}
                confirmLabel={props.props.rotate.confirmLabel}
                cancelLabel={props.props.rotate.cancelLabel}
                isPending={props.props.rotate.isPending}
                onConfirm={props.on.confirmRotate}
                onDismiss={props.on.dismissRotate}
            />
        ) : null}
    </>
)
