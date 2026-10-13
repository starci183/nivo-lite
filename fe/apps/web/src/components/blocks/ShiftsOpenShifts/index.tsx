"use client"

import { useTranslations } from "next-intl"
import { useState } from "react"
import { useShiftsBenchData, useShiftsFormat, useShiftsMineData } from "@/hooks/shifts"
import { useShiftsMineCommands } from "@/hooks/shiftsCommands"
import { ShiftsOpenShiftsBase } from "./component"

/** The open shifts nobody has yet, each with a button to ask for it. */
export const ShiftsOpenShifts = () => {
    const t = useTranslations("shifts")
    const mine = useShiftsMineData().data
    const bench = useShiftsBenchData(null).data
    const format = useShiftsFormat()
    const commands = useShiftsMineCommands()
    const [busyId, setBusyId] = useState<string | null>(null)
    if (mine === undefined || bench === undefined || mine.profileId === null) return null

    const positionName = (id: string): string =>
        bench.setup.positions.find((position) => position.id === id)?.name ?? ""

    const claim = async (id: string) => {
        setBusyId(id)
        await commands.claimShift(id)
        setBusyId(null)
    }

    return (
        <ShiftsOpenShiftsBase
            props={{
                title: t("openShifts"),
                hint: t("openShiftsHint"),
                emptyLabel: t("openNone"),
                claimLabel: t("claim"),
                shifts: mine.openShifts.map((shift) => ({
                    id: shift.id,
                    title: `${format.dayFull(shift.date)} · ${shift.start}-${shift.end}`,
                    notes: [positionName(shift.positionId)],
                    isBusy: busyId === shift.id,
                })),
            }}
            on={{ claim: (id) => void claim(id) }}
        />
    )
}
