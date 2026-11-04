import type { Dispatch, SetStateAction } from "react"
import { digitsToNumber } from "@/modules/utils"
import type { useSalesContractForm } from "@/hooks/rhf"
import type { useSalesActions } from "@/hooks/sales"
import type { SalesContract } from "@/modules/types"
import { useGraphQLWithToast } from "@/modules/toast"
import { NO_LEAD } from "./salescontracts.shared"

/** One save in flight: the panel scope that started it and whether that panel is still the mounted one. */
export interface ContractOperation {
    readonly scope: string
    readonly isCurrent: () => boolean
}

/** The form, the command and the panel lifetime one save acts on. */
export interface ContractSubmitInput {
    readonly form: ReturnType<typeof useSalesContractForm>
    readonly actions: ReturnType<typeof useSalesActions>
    readonly editing: SalesContract | null
    readonly isOpen: boolean
    readonly isPending: boolean
    readonly scope: string
    readonly capture: () => () => boolean
    readonly setOperation: Dispatch<SetStateAction<ContractOperation | null>>
    readonly onSaved: () => void
}

/** RHF validates locally; the original command owns remote feedback and this operation owns local completion. */
export const useContractSubmit = (input: ContractSubmitInput): (() => void) => {
    const runGraphQL = useGraphQLWithToast()
    return (): void => {
        const { form, actions, editing } = input
        const pending = { scope: input.scope, isCurrent: input.capture() }
        if (!pending.isCurrent() || !input.isOpen || input.isPending) return
        input.setOperation(pending)
        const finish = () => input.setOperation((current) => (current === pending ? null : current))
        form.handleSubmit((submitted) => {
            if (!pending.isCurrent()) return finish()
            actions
                .saveContract({
                    contractId: editing?.id ?? null,
                    leadId: submitted.leadId === NO_LEAD ? null : submitted.leadId,
                    customerName: submitted.customerName,
                    plan: submitted.plan,
                    startsOn: submitted.startsOn,
                    endsOn: submitted.endsOn,
                    amountVnd: digitsToNumber(submitted.amount),
                    status: submitted.status,
                    note: submitted.note,
                })
                .then((result) => {
                    if (result !== undefined && pending.isCurrent()) input.onSaved()
                })
                .catch((error: unknown) => runGraphQL(() => Promise.reject(error), { showSuccessToast: false }))
                .finally(finish)
        }, finish)().catch((error: unknown) =>
            runGraphQL(() => Promise.reject(error), { showSuccessToast: false }).finally(finish),
        )
    }
}
