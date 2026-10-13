"use client"

import { useCallback } from "react"
import { useMutateRemoveShiftsCoverageSwr } from "@/hooks/swr/api/graphql/mutations/useMutateRemoveShiftsCoverageSwr"
import { useMutateRemoveShiftsPositionSwr } from "@/hooks/swr/api/graphql/mutations/useMutateRemoveShiftsPositionSwr"
import { useMutateSaveShiftsCoverageSwr } from "@/hooks/swr/api/graphql/mutations/useMutateSaveShiftsCoverageSwr"
import { useMutateSaveShiftsPositionSwr } from "@/hooks/swr/api/graphql/mutations/useMutateSaveShiftsPositionSwr"
import { useMutateSaveShiftsStaffSwr } from "@/hooks/swr/api/graphql/mutations/useMutateSaveShiftsStaffSwr"
import { useShiftsSaved } from "./useShiftsSaved"

/** What a manager types for one person of the roster. */
interface ShiftsStaffInput {
    readonly id: string | null
    readonly name: string
    readonly positionIds: ReadonlyArray<string>
    readonly wage: number
    readonly maxWeek: number
    readonly maxDay: number
    readonly minRest: number
    readonly staffRowId: string | null
    readonly phone: string
    readonly telegramChatId: string
    readonly zaloUserId: string
    readonly active: boolean
}

/** What a manager types for coverage blocks over a set of weekdays. */
interface ShiftsCoverageInput {
    readonly weekdays: ReadonlyArray<number>
    readonly start: string
    readonly end: string
    readonly positionId: string
    readonly min: number
    readonly ideal: number
    readonly peak: boolean
}

/** The roster and demand commands. A failure was toasted with the back end words; the answer is `false` then. */
interface ShiftsSetupCommands {
    readonly addPosition: (name: string) => Promise<boolean>
    readonly removePosition: (id: string) => Promise<boolean>
    readonly saveStaff: (input: ShiftsStaffInput) => Promise<boolean>
    readonly saveCoverage: (input: ShiftsCoverageInput) => Promise<boolean>
    readonly removeCoverage: (id: string) => Promise<boolean>
}

/** The positions, staff and coverage commands of the Shifts workbench through the back end GraphQL API, toasted, with the reads revalidated. */
export const useShiftsSetupCommands = (): ShiftsSetupCommands => {
    const finish = useShiftsSaved()
    const savingPosition = useMutateSaveShiftsPositionSwr()
    const removingPosition = useMutateRemoveShiftsPositionSwr()
    const savingStaff = useMutateSaveShiftsStaffSwr()
    const savingCoverage = useMutateSaveShiftsCoverageSwr()
    const removingCoverage = useMutateRemoveShiftsCoverageSwr()

    const addPosition = useCallback(
        (name: string) => finish(() => savingPosition.trigger({ name: name.trim() })),
        [finish, savingPosition],
    )
    const removePosition = useCallback(
        (id: string) => finish(() => removingPosition.trigger({ id })),
        [finish, removingPosition],
    )
    const saveStaff = useCallback(
        (input: ShiftsStaffInput) =>
            finish(() =>
                savingStaff.trigger({
                    ...(input.id === null ? {} : { id: input.id }),
                    name: input.name.trim(),
                    positionIds: [...input.positionIds],
                    wage: input.wage,
                    maxWeek: input.maxWeek,
                    maxDay: input.maxDay,
                    minRest: input.minRest,
                    staffRowId: input.staffRowId,
                    phone: input.phone.trim() || null,
                    telegramChatId: input.telegramChatId.trim() || null,
                    zaloUserId: input.zaloUserId.trim() || null,
                    active: input.active,
                }),
            ),
        [finish, savingStaff],
    )
    const saveCoverage = useCallback(
        (input: ShiftsCoverageInput) =>
            finish(() =>
                savingCoverage.trigger({
                    weekdays: [...input.weekdays],
                    start: input.start,
                    end: input.end,
                    positionId: input.positionId,
                    min: input.min,
                    ideal: input.ideal,
                    peak: input.peak,
                }),
            ),
        [finish, savingCoverage],
    )
    const removeCoverage = useCallback(
        (id: string) => finish(() => removingCoverage.trigger({ id })),
        [finish, removingCoverage],
    )
    return { addPosition, removePosition, saveStaff, saveCoverage, removeCoverage }
}
