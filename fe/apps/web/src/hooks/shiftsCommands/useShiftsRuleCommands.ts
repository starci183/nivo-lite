"use client"

import { useCallback } from "react"
import { useMutateAddShiftsAvailabilitySwr } from "@/hooks/swr/api/graphql/mutations/useMutateAddShiftsAvailabilitySwr"
import { useMutateRemoveShiftsAvailabilitySwr } from "@/hooks/swr/api/graphql/mutations/useMutateRemoveShiftsAvailabilitySwr"
import { useMutateSaveShiftsSettingsSwr } from "@/hooks/swr/api/graphql/mutations/useMutateSaveShiftsSettingsSwr"
import { useShiftsSaved } from "./useShiftsSaved"

/** The shop rules a manager edits. */
interface ShiftsRulesInput {
    readonly swapNoticeHours: number
    readonly leaveNoticeDays: number
    readonly remindMinutes: number
    readonly noshowMinutes: number
    readonly overtimeHoursWeek: number
    /** Opening hours by weekday (0 = Monday); a closed day is `null`. */
    readonly openingHours: Readonly<Record<string, { readonly open: string; readonly close: string } | null>>
}

/** An availability window a manager enters for one person. */
interface ShiftsAvailabilityInput {
    readonly staffId: string
    readonly weekday: number | null
    readonly date: string | null
    readonly start: string
    readonly end: string
    readonly available: boolean
}

/** The rules and availability commands. A failure was toasted with the back end words; the answer is `false` then. */
interface ShiftsRuleCommands {
    readonly saveSettings: (input: ShiftsRulesInput) => Promise<boolean>
    readonly addAvailability: (input: ShiftsAvailabilityInput) => Promise<boolean>
    readonly removeAvailability: (id: string) => Promise<boolean>
}

/** The rules and availability commands of the Shifts workbench through the back end GraphQL API, toasted, with the reads revalidated. */
export const useShiftsRuleCommands = (): ShiftsRuleCommands => {
    const finish = useShiftsSaved()
    const savingSettings = useMutateSaveShiftsSettingsSwr()
    const addingAvailability = useMutateAddShiftsAvailabilitySwr()
    const removingAvailability = useMutateRemoveShiftsAvailabilitySwr()

    const saveSettings = useCallback(
        (input: ShiftsRulesInput) =>
            finish(() =>
                savingSettings.trigger({
                    swapNoticeHours: input.swapNoticeHours,
                    leaveNoticeDays: input.leaveNoticeDays,
                    remindMinutes: input.remindMinutes,
                    noshowMinutes: input.noshowMinutes,
                    overtimeHoursWeek: input.overtimeHoursWeek,
                    openingHours: Object.entries(input.openingHours).flatMap(([weekday, day]) =>
                        day === null ? [] : [[{ weekday: Number(weekday), open: day.open, close: day.close }]],
                    ),
                }),
            ),
        [finish, savingSettings],
    )
    const addAvailability = useCallback(
        (input: ShiftsAvailabilityInput) => finish(() => addingAvailability.trigger({ ...input, note: null })),
        [finish, addingAvailability],
    )
    const removeAvailability = useCallback(
        (id: string) => finish(() => removingAvailability.trigger({ id })),
        [finish, removingAvailability],
    )
    return { saveSettings, addAvailability, removeAvailability }
}
