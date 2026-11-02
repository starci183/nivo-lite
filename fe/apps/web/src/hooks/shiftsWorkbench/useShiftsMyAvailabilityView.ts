import { useFeatureReset } from "@/hooks/reuseables"
import { useShiftsOperation } from "./useShiftsOperation"
import type { ShiftsPersonalViews, ShiftsPersonalActions } from "@/modules/types"
import type { ShiftsPanelInput } from "./shiftsWorkbench.shared"
type FullView = {
    readonly props: ShiftsPersonalViews["myAvailabilityData"]
    readonly on: ShiftsPersonalActions["myAvailability"]
}

import { useTranslations } from "next-intl"
import { useState } from "react"
import { requestStatusOf, useShiftsFormat, useShiftsWhenFields } from "@/hooks/shifts"
import { useShiftsMineCommands } from "@/hooks/shiftsCommands"

/** What is typed in the availability form. */
interface AvailabilityForm {
    readonly mode: string
    readonly weekday: string
    readonly date: string
    readonly start: string
    readonly end: string
    readonly note: string
    readonly available: boolean
}

const INITIAL_FORM: AvailabilityForm = {
    mode: "weekday",
    weekday: "0",
    date: "",
    start: "07:00",
    end: "22:00",
    note: "",
    available: true,
}
const LIST_LIMIT = 10
const NO_OPTIONS: ReadonlyArray<{ readonly id: string; readonly label: string }> = []

interface AvailabilityReadyInput {
    readonly t: ReturnType<typeof useTranslations<"shifts">>
    readonly format: ReturnType<typeof useShiftsFormat>
    readonly form: AvailabilityForm
    readonly setForm: React.Dispatch<React.SetStateAction<AvailabilityForm>>
    readonly operation: ReturnType<typeof useShiftsOperation>
    readonly commands: ReturnType<typeof useShiftsMineCommands>
    readonly date: string
    readonly isWeekly: boolean
    readonly when: ReturnType<typeof useShiftsWhenFields>
    readonly mine: NonNullable<ShiftsPanelInput["mine"]["data"]>
}
const buildMyAvailabilityReady = (context: AvailabilityReadyInput): FullView => {
    const { t, format, form, setForm, operation, commands, date, isWeekly, when, mine } = context
    const send = async () => {
        const isCurrent = operation.capture()

        const done = await operation.run("write", () =>
            commands.sendAvailability({
                weekday: isWeekly ? Number(form.weekday) : null,
                date: isWeekly ? null : date,
                start: form.start,
                end: form.end,
                available: form.available,
                note: form.note,
            }),
        )
        if (done && isCurrent()) setForm((current) => ({ ...current, note: "" }))
    }
    const whenOf = (weekday: number | null, date: string | null): string =>
        date === null ? format.weekdayName(weekday ?? 0, "long") : format.dayMonth(date)

    const view: FullView = {
        props: {
            fields: [...when, { id: "note", label: t("note"), value: form.note, options: NO_OPTIONS }],
            rows: mine.availability.slice(0, LIST_LIMIT).map((row) => ({
                id: row.id,
                text: `${t(row.available ? "canWork" : "cannotWork")} ${whenOf(row.weekday, row.date)} ${row.start}-${row.end}`,
                badge: { tone: requestStatusOf(row.status).tone, label: t(requestStatusOf(row.status).key) },
                actionLabel: null,
            })),
        },
        on: {
            field: (id, value) => setForm((current) => ({ ...current, [id]: value })),
            available: (available) => setForm((current) => ({ ...current, available })),
            submit: () => operation.observe(send()),
        },
    }

    return view
}

/** When I can work: tell the shop the days or hours I cannot, and see what was approved. */
export const useShiftsMyAvailabilityView = (input: ShiftsPanelInput) => {
    const t = useTranslations("shifts")
    const format = useShiftsFormat()
    const mine = input.mine.data
    const commands = useShiftsMineCommands()
    const [form, setForm] = useState<AvailabilityForm>(INITIAL_FORM)
    const operation = useShiftsOperation(input)
    const isBusy = operation.tag !== null
    const today = mine?.today ?? ""
    const date = form.date === "" ? today : form.date
    const isWeekly = form.mode === "weekday"
    const when = useShiftsWhenFields({ ...form, date }, today)
    useFeatureReset({
        isActive: input.isActive,
        isReady: true,
        scope: input.scope,
        onReset: () => {
            setForm(INITIAL_FORM)
        },
    })

    const copy: ShiftsPersonalViews["myAvailabilityCopy"] = {
        fieldStructure: [
            ...when.map((field) => ({ id: field.id, label: field.label, control: "select" as const })),
            { id: "note", label: t("note"), control: "input" },
        ],
        title: t("availTitle"),
        hint: t("availHint"),
        switchLabel: t(form.available ? "canWork" : "cannotWork"),
        switchOn: form.available,
        submitLabel: t("sendAvail"),
        submitIntent: "commit",
        isBusy,
        canSubmit: true,
    }

    if (mine?.profileId === undefined || mine.profileId === null) return { copy, data: undefined, on: undefined }

    const view = buildMyAvailabilityReady({ t, format, form, setForm, operation, commands, date, isWeekly, when, mine })
    return { copy, data: view.props, on: view.on }
}
