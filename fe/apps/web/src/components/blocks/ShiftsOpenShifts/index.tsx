"use client"

import { useTranslations } from "next-intl"
import { useState } from "react"
import { useShiftsFormat } from "@/hooks/shifts"
import { useShiftsMineCommands } from "@/hooks/shiftsCommands"
import type { ShiftsMineView, ShiftsPositionView } from "@/modules/types"
import { ShiftsOpenShiftsBase } from "./component"

/** The person's view and the positions of the shop. */
interface ShiftsOpenShiftsProps {
    readonly mine: ShiftsMineView
    readonly positions: ReadonlyArray<ShiftsPositionView>
}

/** The open shifts nobody has yet, each with a button to ask for it. */
export const ShiftsOpenShifts = (props: ShiftsOpenShiftsProps) => {
    const t = useTranslations("shifts")
    const format = useShiftsFormat()
    const commands = useShiftsMineCommands()
    const [busyId, setBusyId] = useState<string | null>(null)
    const positionName = (id: string): string => props.positions.find((position) => position.id === id)?.name ?? ""

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
                shifts: props.mine.openShifts.map((shift) => ({
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
