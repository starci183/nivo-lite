import { useState } from "react"
import { useFeatureReset } from "@/hooks/reuseables"
import { useShiftsRequestCommands, useShiftsWeekCommands } from "@/hooks/shiftsCommands"
import { useShiftsOperation } from "./useShiftsOperation"
import type { ShiftsPanelInput } from "./shiftsWorkbench.shared"
/** Owns one bar's propose/explain/publish decision settlement without resetting the chosen Monday. */
export const useShiftsWeekBarActions = (input: ShiftsPanelInput) => {
    const week = useShiftsWeekCommands(),
        requests = useShiftsRequestCommands()
    const operation = useShiftsOperation(input)
    const [isExplaining, setExplaining] = useState(false)
    useFeatureReset({
        isActive: input.isActive,
        isReady: true,
        scope: input.scope,
        onReset: () => setExplaining(false),
    })
    const propose = () => {
        const bench = input.bench.data
        if (bench === undefined) return
        const isCurrent = operation.capture()
        operation.observe(
            operation.run("propose", async () => {
                if (isCurrent()) setExplaining(false)
                const scheduleId = await week.propose(bench.week.monday)
                if (scheduleId === undefined) return
                if (isCurrent()) setExplaining(true)
                await week.explain(scheduleId)
            }),
        )
    }
    const publish = () => {
        const schedule = input.bench.data?.week.current
        if (schedule !== null && schedule !== undefined)
            operation.observe(operation.run("publish", () => week.publish(schedule.id)))
    }
    const decide = (decision: "approved" | "rejected") => {
        const item = input.bench.data?.week.publishItem
        if (item !== null && item !== undefined)
            operation.observe(operation.run("decide", () => requests.decideItem(item.id, decision)))
    }
    const busy = () => {
        if (operation.tag === "propose") return isExplaining ? ("explain" as const) : ("propose" as const)
        if (operation.tag === "publish") return "publish" as const
        if (operation.tag === "decide") return "decide" as const
        return null
    }
    return { busy: busy(), propose, publish, approve: () => decide("approved"), decline: () => decide("rejected") }
}
