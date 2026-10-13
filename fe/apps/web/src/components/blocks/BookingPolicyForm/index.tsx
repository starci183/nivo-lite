"use client"

import { useTranslations } from "next-intl"
import { useState, useTransition } from "react"
import { useSWRConfig } from "swr"
import { isQueryBookingBoardSwrKey, useMutateSaveBookingPolicySwr } from "@/hooks/swr/api/graphql"
import { useGraphQLWithToast } from "@/modules/toast"
import type { BookingSettingsView } from "@/modules/types"
import { BookingPolicyFormBase } from "./component"

/** The numeric rules of the policy, by the id the form uses. */
const RULES = [
    ["cancelWindowHours", "ruleCancelWindow"],
    ["lateCancelFeePct", "ruleLateFee"],
    ["noShowFeeVnd", "ruleNoShowFee"],
    ["depositPct", "ruleDeposit"],
    ["minLeadMin", "ruleMinLead"],
    ["maxAdvanceDays", "ruleMaxAdvance"],
    ["slotStepMin", "ruleSlotStep"],
] as const

/** The numbers the owner edits. */
type Numbers = Readonly<Record<(typeof RULES)[number][0], number>>

/** What the setup tab hands the connected policy form. */
interface BookingPolicyFormProps {
    readonly settings: BookingSettingsView
}

/** The connected policy form: saves the cancellation, deposit and slot rules of the workspace. */
export const BookingPolicyForm = (props: BookingPolicyFormProps) => {
    const t = useTranslations("workbenchBooking")
    const withToast = useGraphQLWithToast()
    const { mutate } = useSWRConfig()
    const savePolicy = useMutateSaveBookingPolicySwr()
    const { settings } = props
    const [numbers, setNumbers] = useState<Numbers>({
        cancelWindowHours: settings.cancelWindowHours,
        lateCancelFeePct: settings.lateCancelFeePct,
        noShowFeeVnd: settings.noShowFeeVnd,
        depositPct: settings.depositPct,
        minLeadMin: settings.minLeadMin,
        maxAdvanceDays: settings.maxAdvanceDays,
        slotStepMin: settings.slotStepMin,
    })
    const [address, setAddress] = useState(settings.address)
    const [autoConfirm, setAutoConfirm] = useState(settings.autoConfirm)
    const [handoff, setHandoff] = useState(settings.handoffOrder)
    const [isPending, startTransition] = useTransition()
    const save = () =>
        startTransition(async () => {
            const answer = await withToast(
                () =>
                    savePolicy.trigger({
                        cancelWindowHours: Math.round(numbers.cancelWindowHours),
                        lateCancelFeePct: Math.round(numbers.lateCancelFeePct),
                        noShowFeeVnd: Math.round(numbers.noShowFeeVnd),
                        depositPct: Math.round(numbers.depositPct),
                        minLeadMin: Math.round(numbers.minLeadMin),
                        maxAdvanceDays: Math.round(numbers.maxAdvanceDays),
                        slotStepMin: Math.round(numbers.slotStepMin),
                        autoConfirm,
                        handoffOrder: handoff,
                        address,
                        timezone: settings.timezone,
                    }),
                { successMessage: t("saved") },
            )
            if (answer === undefined) return
            void mutate(isQueryBookingBoardSwrKey)
        })
    return (
        <BookingPolicyFormBase
            props={{
                title: t("policyTitle"),
                hint: t("policyHint"),
                rules: RULES.map(([id, key]) => ({ id, label: t(key), value: numbers[id] })),
                addressLabel: t("policyAddress"),
                address,
                autoConfirmLabel: t("policyAutoConfirm"),
                autoConfirm,
                handoffLabel: t("policyHandoff"),
                handoff,
                saveLabel: t("policySave"),
                isPending,
            }}
            on={{
                changeRule: (id, value) => setNumbers({ ...numbers, [id]: Number.isFinite(value) ? value : 0 }),
                changeAddress: setAddress,
                toggleAutoConfirm: setAutoConfirm,
                toggleHandoff: setHandoff,
                save,
            }}
        />
    )
}
