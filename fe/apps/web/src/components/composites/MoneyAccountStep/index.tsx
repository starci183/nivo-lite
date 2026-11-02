import { Input, Select, Text } from "@starci/grammar/common"
import type { MoneyAccountView, MoneyWizardCopy } from "@/modules/types"
import { moneyAccountClassNames as classNames } from "./classNames"

/** The resolved account fields and the individual edits they report. */
interface MoneyAccountStepProps extends MoneyAccountView {
    readonly isPending: boolean
    readonly isLoading: boolean
    readonly text: Pick<
        MoneyWizardCopy,
        | "fieldName"
        | "fieldNameHint"
        | "fieldBank"
        | "fieldBankPlaceholder"
        | "fieldAccount"
        | "fieldHolder"
        | "createdLocked"
    >
    readonly onName: (value: string) => void
    readonly onBank: (value: string) => void
    readonly onAccount: (value: string) => void
    readonly onHolder: (value: string) => void
}

/** Draws the same account fields, provider-specific bank choice and saved-account lock note. */
export const MoneyAccountStep = (props: MoneyAccountStepProps) => (
    <>
        <div className={classNames.fields}>
            <Input
                id="w-name"
                name="name"
                label={props.text.fieldName}
                description={props.text.fieldNameHint}
                isDisabled={props.isPending}
                isLoading={props.isLoading}
                value={props.form.name}
                onValueChange={props.onName}
            />
            {props.needsBank ? (
                <>
                    <Select
                        label={props.text.fieldBank}
                        placeholder={props.text.fieldBankPlaceholder}
                        isDisabled={props.isPending}
                        value={props.form.bank === "" ? null : props.form.bank}
                        options={[...props.bankOptions]}
                        onValueChange={(value) => props.onBank(value ?? "")}
                        isLoading={props.isLoading}
                    />
                    <Input
                        id="w-account"
                        name="account"
                        label={props.text.fieldAccount}
                        isDisabled={props.isPending}
                        value={props.form.account}
                        description={props.accountHint}
                        onValueChange={props.onAccount}
                        isLoading={props.isLoading}
                    />
                    <Input
                        id="w-holder"
                        name="holder"
                        label={props.text.fieldHolder}
                        isDisabled={props.isPending}
                        value={props.form.holder}
                        onValueChange={props.onHolder}
                        isLoading={props.isLoading}
                    />
                </>
            ) : null}
        </div>
        {props.isLocked ? (
            <Text size="xs" tone="muted">
                {props.text.createdLocked}
            </Text>
        ) : null}
    </>
)
