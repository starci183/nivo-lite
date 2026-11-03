"use client"

import { useState } from "react"
import { useFeatureReset } from "@/hooks/reuseables"
import { useShiftsWhenFields } from "@/hooks/shifts"
import type { ShiftsPanelInput } from "./shiftsWorkbench.shared"
import { useShiftsOperation } from "./useShiftsOperation"

/** What every availability form types about when someone can or cannot work. */
interface AvailabilityWhen {
    readonly mode: string
    readonly weekday: string
    readonly date: string
    readonly start: string
    readonly end: string
    readonly available: boolean
}

/** The form being typed, the operation that sends it, and the when-fields it draws; the form starts again with the panel's lifetime. */
export const useShiftsAvailabilityDraft = <Form extends AvailabilityWhen>(
    input: ShiftsPanelInput,
    initial: Form,
    today: string,
) => {
    const [form, setForm] = useState<Form>(initial)
    const operation = useShiftsOperation(input)
    const date = form.date === "" ? today : form.date
    const when = useShiftsWhenFields({ ...form, date }, today)
    useFeatureReset({
        isActive: input.isActive,
        isReady: true,
        scope: input.scope,
        onReset: () => {
            setForm(initial)
        },
    })
    return { form, setForm, operation, isBusy: operation.tag !== null, date, isWeekly: form.mode === "weekday", when }
}
