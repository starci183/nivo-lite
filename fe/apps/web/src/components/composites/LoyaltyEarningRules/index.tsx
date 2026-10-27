import type { ReactNode } from "react"
import { Button, Heading, Select, Text } from "@starci/grammar/common"

import { LoyaltyField } from "@/components/leaves/LoyaltyField"
import { LoyaltySettingsSection } from "@/components/leaves/LoyaltySettingsSection"
import { FIELD_TRIPLE_CLASS_NAME } from "./classNames"
import type { ProgramCopy, ProgramTextField, ProgramValues } from "@/modules/types"
/** Inputs and commands for the LoyaltyEarningRules presentation. */
interface LoyaltyEarningRulesProps {
    readonly children: ReactNode
    readonly props: {
        readonly canEdit: boolean
        readonly isPending: boolean
        readonly copy: Pick<
            ProgramCopy,
            | "earnTitle"
            | "earnHint"
            | "name"
            | "trigger"
            | "triggerHint"
            | "categories"
            | "categoriesHint"
            | "addCategory"
            | "perThousand"
            | "perThousandHint"
            | "perVisit"
            | "minOrder"
            | "minOrderHint"
        >
        readonly values: Pick<ProgramValues, "name" | "trigger" | "perThousand" | "perVisit" | "minOrder">
        readonly errors: {
            readonly name?: string | undefined
        }
        readonly canAddCategory: boolean
        readonly triggerOptions: ReadonlyArray<{ readonly id: string; readonly label: string }>
    }
    readonly on: {
        readonly change: (field: ProgramTextField, value: string) => void

        readonly addCategory: () => void
    }
}

/** Earning rates and category-rule controls. */
export const LoyaltyEarningRules = (props: LoyaltyEarningRulesProps) => {
    const { props: p, on } = props
    const { copy, values } = p
    const off = !p.canEdit || p.isPending
    return (
        <LoyaltySettingsSection title={copy.earnTitle} hint={copy.earnHint}>
            <LoyaltyField
                id="lp-name"
                label={copy.name}
                value={values.name}
                error={p.errors.name}
                isDisabled={off}
                onChange={(value) => on.change("name", value)}
            />
            {renderEarningRates(p, on)}
            <Select
                label={copy.trigger}
                description={copy.triggerHint}
                options={p.triggerOptions}
                value={values.trigger}
                isDisabled={off}
                onValueChange={(value) => on.change("trigger", value ?? "")}
            />
            <Heading level={3}>{copy.categories}</Heading>
            <Text size="sm" tone="muted">
                {copy.categoriesHint}
            </Text>
            {props.children}
            {p.canEdit && p.canAddCategory ? (
                <div>
                    <Button intent="neutral" size="sm" isDisabled={p.isPending} onPress={on.addCategory}>
                        {copy.addCategory}
                    </Button>
                </div>
            ) : null}
        </LoyaltySettingsSection>
    )
}

const renderEarningRates = (p: LoyaltyEarningRulesProps["props"], on: LoyaltyEarningRulesProps["on"]) => {
    const { copy, values } = p
    const off = !p.canEdit || p.isPending
    return (
        <div className={FIELD_TRIPLE_CLASS_NAME}>
            <LoyaltyField
                id="lp-per-thousand"
                label={copy.perThousand}
                hint={copy.perThousandHint}
                value={values.perThousand}
                isDisabled={off}
                onChange={(value) => on.change("perThousand", value)}
            />
            <LoyaltyField
                id="lp-per-visit"
                label={copy.perVisit}
                value={values.perVisit}
                isDisabled={off}
                onChange={(value) => on.change("perVisit", value)}
            />
            <LoyaltyField
                id="lp-min-order"
                label={copy.minOrder}
                hint={copy.minOrderHint}
                value={values.minOrder}
                isDisabled={off}
                onChange={(value) => on.change("minOrder", value)}
            />
        </div>
    )
}
