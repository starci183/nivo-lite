"use client"

import { useFeatureReset } from "@/hooks/reuseables"

import { useBookingTransition } from "@/hooks/bookingDesk"

import type { useBookingBoard } from "@/hooks/bookingBoard"
import { useTranslations } from "next-intl"
import { useState } from "react"
import { useBookingSettingsCommands } from "@/hooks/bookingSetup"

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

/** The view `useBookingPolicyFormView` returns. */
export interface BookingPolicyFormView {
    readonly props: {
        readonly title: string
        readonly hint: string
        readonly rules: {
            id:
                | "cancelWindowHours"
                | "depositPct"
                | "lateCancelFeePct"
                | "maxAdvanceDays"
                | "minLeadMin"
                | "noShowFeeVnd"
                | "slotStepMin"
            label: string
            value: number
        }[]
        readonly addressLabel: string
        readonly address: string
        readonly autoConfirmLabel: string
        readonly autoConfirm: boolean
        readonly handoffLabel: string
        readonly handoff: boolean
        readonly saveLabel: string
        readonly isPending: boolean
    }
    readonly on: {
        readonly changeRule: (id: string, value: number) => void
        readonly changeAddress: (value: string) => void
        readonly toggleAutoConfirm: (value: boolean) => void
        readonly toggleHandoff: (value: boolean) => void
        readonly save: () => void
    }
}

/** The connected policy form: saves the cancellation, deposit and slot rules of the workspace. */
export const useBookingPolicyFormView = (
    isActive: boolean,
    scope: string,
    boardRead: ReturnType<typeof useBookingBoard>,
): BookingPolicyFormView => {
    const { board } = boardRead
    const t = useTranslations("workbenchBooking")
    const commands = useBookingSettingsCommands()
    const settings = board.settings
    const [edits, setEdits] = useState<Edits>({})
    useFeatureReset({
        isActive: isActive,
        isReady: true,
        scope: scope,
        onReset: () => {
            setEdits({})
        },
    })
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
    const { isPending, run: startTransition } = useBookingTransition(isActive, scope)
    const save = () =>
        startTransition(async () => {
            const answer = await commands.savePolicy({
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
            })
            if (answer === undefined) return
        })
    return {
        props: {
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
            isPending: isPending,
        },
        on: {
            changeRule: (id: string, value: number) => setEdits({ ...edits, [id]: Number.isFinite(value) ? value : 0 }),
            changeAddress: (value: string) => setEdits({ ...edits, address: value }),
            toggleAutoConfirm: (value: boolean) => setEdits({ ...edits, autoConfirm: value }),
            toggleHandoff: (value: boolean) => setEdits({ ...edits, handoffOrder: value }),
            save,
        },
    } as const
}
