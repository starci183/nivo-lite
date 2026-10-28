import { Button, CopyField, FormGrid, Input, Select, SurfaceCard, Text } from "@starci/grammar/common"
import { SlotView } from "@/components/composites/SlotView"
import type { DataSlot, SepayAccountForm, SlotLabels } from "@/modules/types"
import { sepaySetupClassNames as classNames } from "./classNames"

/** What the setup tab shows once the connection is read. */
export interface SepaySetupView {
    readonly webhookUrl: string
    readonly apiKeyMasked: string
    readonly accountHint: string
}

/** Props for {@link SepaySetupBase}. */
export interface SepaySetupBaseProps {
    readonly props: {
        readonly slot: DataSlot<SepaySetupView>
        readonly placeholder: SepaySetupView
        readonly labels: SlotLabels
        readonly copyLabel: string
        readonly copiedLabel: string
        readonly copyErrorLabel: string
        readonly pasteTitle: string
        readonly webhookLabel: string
        readonly keyLabel: string
        readonly factsLine: string
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
    }
    readonly on: {
        readonly retry: () => void
        /** Reveals the clear key for the clipboard only; rejects when the reveal fails. */
        readonly copyKey: () => Promise<string>
        readonly bank: (bank: string) => void
        readonly account: (account: string) => void
        readonly holder: (holder: string) => void
        readonly save: () => void
    }
}

type PasteCardProps = {
    readonly base: SepaySetupBaseProps
    readonly setup: SepaySetupView
    readonly isSkeleton: boolean
}

/** The card of what to paste into SePay. */
const PasteCard = ({ base, setup, isSkeleton }: PasteCardProps) => (
    <SurfaceCard label={base.props.pasteTitle} headingLevel={2}>
        <div className={classNames.stack}>
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
                    lastFour={setup.apiKeyMasked.slice(-4)}
                    onCopy={base.on.copyKey}
                    copyLabel={base.props.copyLabel}
                    copiedLabel={base.props.copiedLabel}
                    copyErrorLabel={base.props.copyErrorLabel}
                    isDisabled={!base.props.canEdit}
                    isSkeleton={isSkeleton}
                />
            </FormGrid>
            <Text size="sm" tone="muted">
                {base.props.factsLine}
            </Text>
        </div>
    </SurfaceCard>
)

/** The card of the bank account whose full number a VietQR needs. */
const AccountCard = ({ base, setup, isSkeleton }: PasteCardProps) => {
    const { props: view, on } = base
    const isLocked = !view.canEdit || view.isPending
    return (
        <SurfaceCard label={view.accountTitle} headingLevel={2}>
            <div className={classNames.stack}>
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
                <div>
                    <Button
                        intent="commit"
                        isPending={view.isPending}
                        isDisabled={!view.canEdit || isSkeleton || view.form.account.trim() === ""}
                        onPress={on.save}
                    >
                        {view.saveLabel}
                    </Button>
                </div>
            </div>
        </SurfaceCard>
    )
}

/** Draws the Setup tab: what to paste into SePay, and the bank account whose full number a VietQR needs. */
export const SepaySetupBase = (props: SepaySetupBaseProps) => (
    <SlotView
        slot={props.props.slot}
        placeholder={props.props.placeholder}
        labels={props.props.labels}
        onRetry={props.on.retry}
    >
        {(setup, isSkeleton) => (
            <div className={classNames.stack}>
                <PasteCard base={props} setup={setup} isSkeleton={isSkeleton} />
                <AccountCard base={props} setup={setup} isSkeleton={isSkeleton} />
            </div>
        )}
    </SlotView>
)
