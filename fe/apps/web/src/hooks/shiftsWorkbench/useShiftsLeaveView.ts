import { useFeatureReset } from "@/hooks/reuseables"
import { useShiftsOperation } from "./useShiftsOperation"
import type { ShiftsPersonalViews, ShiftsPersonalActions } from "@/modules/types"
import type { ShiftsPanelInput } from "./shiftsWorkbench.shared"
type FullView = { readonly props: ShiftsPersonalViews["leaveData"]; readonly on: ShiftsPersonalActions["leave"] }

import { useTranslations } from "next-intl"
import { useState } from "react"
import { requestStatusOf, useShiftsFormat } from "@/hooks/shifts"
import { useShiftsMineCommands } from "@/hooks/shiftsCommands"

/** What is typed in the leave form. */
interface LeaveForm {
    readonly from: string
    readonly to: string
    readonly reason: string
}

const DATE_CHOICES = 90
const LIST_LIMIT = 6
const NO_OPTIONS: ReadonlyArray<{ readonly id: string; readonly label: string }> = []

/** Ask for leave: the day range and the reason, and my latest requests with their state. */
export const useShiftsLeaveView = (input: ShiftsPanelInput) => {
    const t = useTranslations("shifts")
    const format = useShiftsFormat()
    const commands = useShiftsMineCommands()
    const mine = input.mine.data
    const [form, setForm] = useState<LeaveForm>({ from: "", to: "", reason: "" })
    const operation = useShiftsOperation(input)
    const isBusy = operation.tag !== null
    useFeatureReset({
        isActive: input.isActive,
        isReady: true,
        scope: input.scope,
        onReset: () => {
            setForm({ from: "", to: "", reason: "" })
        },
    })

    const copy: ShiftsPersonalViews["leaveCopy"] = {
        fieldStructure: [
            { id: "from", label: t("fromDate"), control: "select" },
            { id: "to", label: t("toDate"), control: "select" },
            { id: "reason", label: t("reason"), control: "input" },
        ],
        title: t("leaveTitle"),
        hint: t("leaveHint"),
        switchLabel: null,
        switchOn: false,
        submitLabel: t("sendLeave"),
        submitIntent: "commit",
        isBusy,
        canSubmit: true,
    }

    if (mine?.profileId === undefined || mine.profileId === null) return { copy, data: undefined, on: undefined }

    const from = form.from === "" ? mine.today : form.from
    const to = form.to === "" || form.to < from ? from : form.to
    const dates = format.dates(mine.today, DATE_CHOICES)

    const send = async () => {
        const isCurrent = operation.capture()

        const done = await operation.run("write", () => commands.requestLeave(from, to, form.reason))
        if (done && isCurrent()) setForm((current) => ({ ...current, reason: "" }))
    }
    const spanOf = (from: string, to: string): string =>
        to === from ? format.dayMonth(from) : `${format.dayMonth(from)} - ${format.dayMonth(to)}`

    const view: FullView = {
        props: {
            fields: [
                { id: "from", label: t("fromDate"), value: from, options: dates },
                {
                    id: "to",
                    label: t("toDate"),
                    value: to,
                    options: dates.filter((option) => option.id >= from),
                },
                { id: "reason", label: t("reason"), value: form.reason, options: NO_OPTIONS },
            ],
            rows: mine.leaves.slice(0, LIST_LIMIT).map((leave) => ({
                id: leave.id,
                text: [spanOf(leave.from, leave.to), leave.reason].filter((part) => part !== "").join(" · "),
                badge: { tone: requestStatusOf(leave.status).tone, label: t(requestStatusOf(leave.status).key) },
                actionLabel: null,
            })),
        },
        on: {
            field: (id, value) => setForm((current) => ({ ...current, [id]: value })),
            submit: () => operation.observe(send()),
        },
    }

    return { copy, data: view.props, on: view.on }
}
