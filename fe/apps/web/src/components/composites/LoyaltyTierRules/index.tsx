import type { ReactNode } from "react"
import { Alert, Button } from "@starci/grammar/common"
import type { ProgramCopy } from "@/modules/types"
/** Inputs and commands for the LoyaltyTierRules presentation. */
interface LoyaltyTierRulesProps {
    readonly rules: ReactNode
    readonly props: {
        readonly canEdit: boolean
        readonly isPending: boolean
        readonly copy: Pick<ProgramCopy, "tiersTitle" | "tiersHint" | "addTier">
        readonly errors: { readonly tiers?: string | undefined }
        readonly canAddTier: boolean
    }
    readonly on: { readonly addTier: () => void }
}

/** Tier validation and controls around the supplied tier cards. */
export const LoyaltyTierRules = (props: LoyaltyTierRulesProps) => {
    const { props: p, on } = props
    const { copy } = p
    return (
        <>
            {p.errors.tiers === undefined ? null : <Alert tone="negative" title={p.errors.tiers} />}
            {props.rules}
            {p.canEdit && p.canAddTier ? (
                <div>
                    <Button intent="neutral" size="sm" isDisabled={p.isPending} onPress={on.addTier}>
                        {copy.addTier}
                    </Button>
                </div>
            ) : null}
        </>
    )
}
