import { useFeatureReset } from "@/hooks/reuseables"
import { useShiftsOperation } from "./useShiftsOperation"
import type { ShiftsSetupViews, ShiftsSetupActions } from "@/modules/types"
import type { ShiftsPanelInput } from "./shiftsWorkbench.shared"
type FullView = { readonly props: ShiftsSetupViews["positionsData"]; readonly on: ShiftsSetupActions["positions"] }

import { useTranslations } from "next-intl"
import { useState } from "react"
import { useShiftsSetupCommands } from "@/hooks/shiftsCommands"

/** The positions of the shop (barista, waiter, cashier): remove one, add a new one. */
export const useShiftsPositionsView = (input: ShiftsPanelInput) => {
    const t = useTranslations("shifts")
    const bench = input.bench.data
    const commands = useShiftsSetupCommands()
    const [name, setName] = useState("")
    const operation = useShiftsOperation(input)
    const isBusy = operation.tag !== null
    useFeatureReset({
        isActive: input.isActive,
        isReady: true,
        scope: input.scope,
        onReset: () => {
            setName("")
        },
    })

    const copy: ShiftsSetupViews["positionsCopy"] = {
        title: t("posTitle"),
        hint: t("posHint"),
        emptyLabel: t("posNone"),
        nameLabel: t("posName"),
        addLabel: t("posAdd"),
        removeLabel: t("remove"),
        name,
        isBusy,
        canAdd: name.trim() !== "",
    }

    if (bench === undefined || bench.role === "staff") return { copy, data: undefined, on: undefined }

    const run = (job: () => Promise<boolean>) => operation.run("write", job)
    const add = async () => {
        const isCurrent = operation.capture()

        if ((await run(() => commands.addPosition(name))) && isCurrent()) setName("")
    }

    const view: FullView = {
        props: {
            positions: bench.setup.positions.map((position) => ({
                id: position.id,
                label: position.name,
                color: position.color,
            })),
        },
        on: {
            name: setName,
            add: () => operation.observe(add()),
            remove: (id) => operation.observe(run(() => commands.removePosition(id))),
        },
    }

    return { copy, data: view.props, on: view.on }
}
