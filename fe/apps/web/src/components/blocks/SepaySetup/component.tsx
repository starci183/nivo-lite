import { Button, Input, Select, SurfaceCard, Text } from "@starci/grammar/common"
import { SlotView } from "@/components/composites/SlotView"
import { ConnectionCopyInput } from "@/components/composites/ConnectionCopyInput"
import type { DataSlot, RowCopyLabels, SepayAccountForm, SlotLabels } from "@/modules/types"
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
        readonly copy: RowCopyLabels
        readonly pasteTitle: string
        readonly webhookLabel: string
        readonly keyLabel: string
        readonly copyKeyLabel: string
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
        readonly copyKey: () => void
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
            <div className={classNames.grid}>
                <ConnectionCopyInput
                    id="sepay-webhook-url"
                    name="webhookUrl"
                    label={base.props.webhookLabel}
                    value={setup.webhookUrl}
                    labels={base.props.copy}
                />
                <div className={classNames.row}>
                    <Input
                        id="sepay-api-key"
                        name="apiKey"
                        label={base.props.keyLabel}
                        value={setup.apiKeyMasked}
                        isReadOnly
                        isSkeleton={isSkeleton}
                    />
                    <Button
                        intent="neutral"
                        isSkeleton={isSkeleton}
                        isDisabled={!base.props.canEdit || isSkeleton}
                        onPress={base.on.copyKey}
                    >
                        {base.props.copyKeyLabel}
                    </Button>
                </div>
            </div>
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
                <div className={classNames.grid}>
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
                </div>
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
