"use client"

import { useTranslations } from "next-intl"
import { useState } from "react"
import { useShiftsBenchData, useShiftsFormat, useShiftsMineData } from "@/hooks/shifts"
import { useShiftsMineCommands } from "@/hooks/shiftsCommands"
import { ShiftsMyShiftsBase } from "./component"
import type { SwapForm } from "./component"

const NO_SWAP: SwapForm = { shiftId: null, toStaffId: "", reason: "" }

/** My upcoming shifts: check in on the day, and ask a colleague to swap one. */
export const ShiftsMyShifts = () => {
    const t = useTranslations("shifts")
    const mine = useShiftsMineData().data
    const bench = useShiftsBenchData(null).data
    const format = useShiftsFormat()
    const commands = useShiftsMineCommands()
    const [swap, setSwap] = useState<SwapForm>(NO_SWAP)
    const [busyId, setBusyId] = useState<string | null>(null)
    if (mine === undefined || bench === undefined) return null

    const positionName = (id: string): string =>
        bench.setup.positions.find((position) => position.id === id)?.name ?? ""

    const run = async (id: string, job: () => Promise<boolean>): Promise<boolean> => {
        setBusyId(id)
        const done = await job()
        setBusyId(null)
        return done
    }
    const send = async (shiftId: string) => {
        if (await run(shiftId, () => commands.requestSwap(shiftId, swap.toStaffId, swap.reason))) setSwap(NO_SWAP)
    }
    const open = mine.myShifts.find((shift) => shift.id === swap.shiftId)

    return (
        <ShiftsMyShiftsBase
            props={{
                notice: mine.profileId === null ? { title: t("noProfileTitle"), body: t("noProfileBody") } : null,
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
                shifts: mine.myShifts.map((shift) => ({
                    id: shift.id,
                    title: `${format.dayFull(shift.date)} · ${shift.start}-${shift.end}`,
                    notes: [
                        shift.status === "swapped"
                            ? `${positionName(shift.positionId)} · ${t("swappedTag")}`
                            : positionName(shift.positionId),
                    ],
                    isCheckedIn: shift.checkedIn,
                    canCheckIn: shift.date === mine.today,
                    isBusy: busyId === shift.id,
                })),
                swap,
                swapOptions:
                    open === undefined
                        ? []
                        : mine.colleagues
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
