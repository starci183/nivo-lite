import { Button, Fieldset, Grid, Input, Select } from "@starci/grammar/common"
import { SlotView } from "@nivo-lite/agent-sdk/client"
import type { DataSlot, SepayAccountForm, SlotLabels } from "@/modules/types"

/** What the second step shows once the connection is read: how the stored account number stands. */
interface SepayAccountView {
    readonly accountHint: string
}

/** Copy, slot and commands of the body of the second setup step: the bank account whose full number a VietQR needs. */
export interface SepayAccountBodyProps {
    readonly props: {
        readonly slot: DataSlot<SepayAccountView>
        readonly placeholder: SepayAccountView
        readonly labels: SlotLabels
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
        readonly bank: (bank: string) => void
        readonly account: (account: string) => void
        readonly holder: (holder: string) => void
        readonly save: () => void
    }
}

/** The bank account whose full number a VietQR needs; the stored number is kept when the field is left empty. */
export const SepayAccountBody = (props: SepayAccountBodyProps) => {
    const { props: view, on } = props
    const isLocked = !view.canEdit || view.isPending
    return (
        <SlotView
            slot={view.slot}
            placeholder={view.placeholder}
            labels={view.labels}
            onRetry={on.retry}
            render={(setup, isLoading) => (
                <Fieldset
                    legend={view.accountTitle}
                    isLegendHidden
                    actions={
                        view.canEdit ? (
                            <Button
                                intent="neutral"
                                isPending={view.isPending}
                                isDisabled={isLoading}
                                onPress={on.save}
                            >
                                {view.saveLabel}
                            </Button>
                        ) : undefined
                    }
                >
                    <Grid kind="form" columns={2}>
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
                            isLoading={isLoading}
                            value={view.form.account}
                            onValueChange={on.account}
                        />
                        <Input
                            id="sepay-holder"
                            name="holder"
                            label={view.holderLabel}
                            isDisabled={isLocked}
                            isLoading={isLoading}
                            value={view.form.holder}
                            onValueChange={on.holder}
                        />
                    </Grid>
                </Fieldset>
            )}
        />
    )
}
