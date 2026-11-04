import type { useTranslations } from "next-intl"
import { useState } from "react"
import type { Dispatch, SetStateAction } from "react"
import { useFeatureLifetime } from "@/hooks/reuseables"
import type { useSalesShipmentForm } from "@/hooks/rhf"
import type { SalesShipping } from "@/modules/types"
import { useGraphQLWithToast } from "@/modules/toast"
import { submitGuarded } from "@/modules/utils"
import type { useSalesActions } from "./useSalesActions"

interface ShipmentSubmissionInput {
    readonly t: ReturnType<typeof useTranslations<"workbenchSales">>
    readonly actions: ReturnType<typeof useSalesActions>
    readonly form: ReturnType<typeof useSalesShipmentForm>
    readonly shipping: SalesShipping | null
    readonly isActive: boolean
    readonly scope: string
    readonly setBusyKey: Dispatch<SetStateAction<string | null>>
    readonly setNotes: Dispatch<SetStateAction<Readonly<Record<string, string>>>>
    readonly setShipping: Dispatch<SetStateAction<SalesShipping | null>>
}

interface ShipmentSubmissionFields {
    readonly carrier: string
    readonly tracking: string
}

/** The shipment command's pending state and its submit event. */
interface ShipmentSubmission {
    readonly isPending: boolean
    readonly submit: () => void
}

/** Keeps RHF local validation separate from the shipment command and its originating drawer. */
export const useShipmentSubmission = (input: ShipmentSubmissionInput): ShipmentSubmission => {
    const { t, actions, form, shipping, scope, setBusyKey, setNotes, setShipping } = input
    const lifetime = useFeatureLifetime(input.isActive, scope)
    const runGraphQL = useGraphQLWithToast()
    const [operation, setOperation] = useState<{ scope: string; isCurrent: () => boolean } | null>(null)
    const isPending = actions.isMutating || (operation?.scope === scope && operation.isCurrent())
    const save = async (submitted: ShipmentSubmissionFields, isCurrent: () => boolean) => {
        if (shipping === null) return
        const result = await actions.markOrderShipped({
            orderId: shipping.orderId,
            carrier: submitted.carrier,
            trackingCode: submitted.tracking,
        })
        if (result === undefined || !isCurrent()) return
        setNotes((previous) => ({ ...previous, [shipping.key]: t("shipDone", { no: result.orderNo }) }))
        setShipping(null)
    }
    return {
        isPending,
        submit: () => {
            const pending = { scope, isCurrent: lifetime.capture() }
            if (!pending.isCurrent() || shipping === null || isPending) return
            setBusyKey(shipping.key)
            setOperation(pending)
            const finish = () => setOperation((current) => (current === pending ? null : current))
            submitGuarded({
                form,
                runGraphQL,
                isCurrent: pending.isCurrent,
                finish,
                save: (submitted) => save(submitted, pending.isCurrent),
            })
        },
    }
}
