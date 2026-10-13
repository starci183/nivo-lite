"use client"

import { useTranslations } from "next-intl"
import { useState, useTransition } from "react"
import { writeBookingPolicy } from "@/modules/db/booking/write-booking-policy"
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
    readonly workspaceId: string
    readonly settings: BookingSettingsView
}

/** The connected policy form: saves the cancellation, deposit and slot rules of the workspace. */
export const BookingPolicyForm = (props: BookingPolicyFormProps) => {
    const t = useTranslations("workbenchBooking")
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
    const [saved, setSaved] = useState<boolean | null>(null)
    const [isPending, startTransition] = useTransition()
    const save = () =>
        startTransition(async () => {
            const answer = await writeBookingPolicy({
                workspaceId: props.workspaceId,
                ...numbers,
                autoConfirm,
                handoffOrder: handoff,
                address,
                timezone: settings.timezone,
            })
            setSaved(answer.kind === "ok")
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
                ...(saved === null
                    ? {}
                    : { notice: { tone: saved ? "affirmative" : "negative", text: t(saved ? "saved" : "failed") } }),
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
