"use client"

import { useTranslations } from "next-intl"
import { useShiftsBenchData } from "@/hooks/shifts"
import { useState } from "react"
import { useShiftsSetupCommands } from "@/hooks/shiftsCommands"
import { ShiftsPositionsBase } from "./component"

/** The positions of the shop (barista, waiter, cashier): remove one, add a new one. */
export const ShiftsPositions = () => {
    const t = useTranslations("shifts")
    const bench = useShiftsBenchData(null).data
    const commands = useShiftsSetupCommands()
    const [name, setName] = useState("")
    const [isBusy, setIsBusy] = useState(false)
    if (bench === undefined || bench.role === "staff") return null

    const run = async (job: () => Promise<boolean>): Promise<boolean> => {
        setIsBusy(true)
        const done = await job()
        setIsBusy(false)
        return done
    }
    const add = async () => {
        if (await run(() => commands.addPosition(name))) setName("")
    }

    return (
        <ShiftsPositionsBase
            props={{
                title: t("posTitle"),
                hint: t("posHint"),
                emptyLabel: t("posNone"),
                nameLabel: t("posName"),
                addLabel: t("posAdd"),
                removeLabel: t("remove"),
                positions: bench.setup.positions.map((position) => ({
                    id: position.id,
                    label: position.name,
                    color: position.color,
                })),
                name,
                isBusy,
                canAdd: name.trim() !== "",
            }}
            on={{
                name: setName,
                add: () => void add(),
                remove: (id) => void run(() => commands.removePosition(id)),
            }}
        />
    )
}
