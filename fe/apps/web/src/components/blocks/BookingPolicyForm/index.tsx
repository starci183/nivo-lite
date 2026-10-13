"use client"

import { useBookingBoard } from "@/hooks/bookingBoard"
import { useTranslations } from "next-intl"
import { useState, useTransition } from "react"
import { useMutateSaveBookingPolicySwr } from "@/hooks/swr"
import { useBookingSetupSave } from "@/hooks/bookingSetup"
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

/** What the owner has typed so far; a field not touched keeps showing the saved value. */
type Edits = Partial<Numbers & { address: string; autoConfirm: boolean; handoffOrder: boolean }>

/** The connected policy form: saves the cancellation, deposit and slot rules of the workspace. */
export const BookingPolicyForm = () => {
    const { board } = useBookingBoard()
    const t = useTranslations("workbenchBooking")
    const persist = useBookingSetupSave()
    const savePolicy = useMutateSaveBookingPolicySwr()
    const settings = board.settings
    const [edits, setEdits] = useState<Edits>({})
    const numbers: Numbers = {
        cancelWindowHours: edits.cancelWindowHours ?? settings.cancelWindowHours,
        lateCancelFeePct: edits.lateCancelFeePct ?? settings.lateCancelFeePct,
        noShowFeeVnd: edits.noShowFeeVnd ?? settings.noShowFeeVnd,
        depositPct: edits.depositPct ?? settings.depositPct,
        minLeadMin: edits.minLeadMin ?? settings.minLeadMin,
        maxAdvanceDays: edits.maxAdvanceDays ?? settings.maxAdvanceDays,
        slotStepMin: edits.slotStepMin ?? settings.slotStepMin,
    }
    const address = edits.address ?? settings.address
    const autoConfirm = edits.autoConfirm ?? settings.autoConfirm
    const handoff = edits.handoffOrder ?? settings.handoffOrder
    const [isPending, startTransition] = useTransition()
    const save = () =>
        startTransition(async () => {
            const answer = await persist(() =>
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
            )
            if (answer === undefined) return
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
                changeRule: (id, value) => setEdits({ ...edits, [id]: Number.isFinite(value) ? value : 0 }),
                changeAddress: (value) => setEdits({ ...edits, address: value }),
                toggleAutoConfirm: (value) => setEdits({ ...edits, autoConfirm: value }),
                toggleHandoff: (value) => setEdits({ ...edits, handoffOrder: value }),
                save,
            }}
        />
    )
}
