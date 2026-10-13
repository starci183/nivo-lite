"use client"

import { useTranslations } from "next-intl"
import { useState } from "react"
import { useShiftsFormat } from "@/hooks/shifts"
import { useShiftsMineCommands } from "@/hooks/shiftsCommands"
import type { ShiftsMineView, ShiftsPositionView } from "@/modules/types"
import { ShiftsMyShiftsBase } from "./component"
import type { SwapForm } from "./component"

/** The person's view and the positions of the shop. */
interface ShiftsMyShiftsProps {
    readonly mine: ShiftsMineView
    readonly positions: ReadonlyArray<ShiftsPositionView>
}

const NO_SWAP: SwapForm = { shiftId: null, toStaffId: "", reason: "" }

/** My upcoming shifts: check in on the day, and ask a colleague to swap one. */
export const ShiftsMyShifts = (props: ShiftsMyShiftsProps) => {
    const t = useTranslations("shifts")
    const format = useShiftsFormat()
    const commands = useShiftsMineCommands()
    const [swap, setSwap] = useState<SwapForm>(NO_SWAP)
    const [busyId, setBusyId] = useState<string | null>(null)
    const positionName = (id: string): string => props.positions.find((position) => position.id === id)?.name ?? ""

    const run = async (id: string, job: () => Promise<boolean>): Promise<boolean> => {
        setBusyId(id)
        const done = await job()
        setBusyId(null)
        return done
    }
    const send = async (shiftId: string) => {
        if (await run(shiftId, () => commands.requestSwap(shiftId, swap.toStaffId, swap.reason))) setSwap(NO_SWAP)
    }
    const open = props.mine.myShifts.find((shift) => shift.id === swap.shiftId)

    return (
        <ShiftsMyShiftsBase
            props={{
                title: t("mineUpcoming"),
                hint: t("mineUpcomingHint"),
                emptyTitle: t("mineNone"),
                emptyBody: t("mineNoneBody"),
                checkInLabel: t("checkIn"),
                checkedInLabel: t("checkedIn"),
                askSwapLabel: t("askSwap"),
                swapWithLabel: t("swapWith"),
                pickPersonLabel: t("pickPerson"),
                reasonLabel: t("reason"),
                sendLabel: t("sendRequest"),
                shifts: props.mine.myShifts.map((shift) => ({
                    id: shift.id,
                    title: `${format.dayFull(shift.date)} · ${shift.start}-${shift.end}`,
                    notes: [
                        shift.status === "swapped"
                            ? `${positionName(shift.positionId)} · ${t("swappedTag")}`
                            : positionName(shift.positionId),
                    ],
                    isCheckedIn: shift.checkedIn,
                    canCheckIn: shift.date === props.mine.today,
                    isBusy: busyId === shift.id,
                })),
                swap,
                swapOptions:
                    open === undefined
                        ? []
                        : props.mine.colleagues
                              .filter((person) => person.positionIds.includes(open.positionId))
                              .map((person) => ({ id: person.id, label: person.name })),
            }}
            on={{
                checkIn: (id) => void run(id, () => commands.checkIn(id)),
                toggleSwap: (id) => setSwap(swap.shiftId === id ? NO_SWAP : { shiftId: id, toStaffId: "", reason: "" }),
                target: (id) => setSwap((current) => ({ ...current, toStaffId: id })),
                reason: (text) => setSwap((current) => ({ ...current, reason: text })),
                send: (id) => void send(id),
            }}
        />
    )
}
