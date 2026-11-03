import type { useShiftsOperation } from "./useShiftsOperation"
import { useShiftsAvailabilityDraft } from "./useShiftsAvailabilityDraft"
import type { ShiftsSetupViews, ShiftsSetupActions } from "@/modules/types"
import type { ShiftsPanelInput } from "./shiftsWorkbench.shared"
type FullView = {
    readonly props: ShiftsSetupViews["availabilityData"]
    readonly on: ShiftsSetupActions["availability"]
}

import { useTranslations } from "next-intl"
import { useShiftsFormat, type useShiftsWhenFields } from "@/hooks/shifts"
import { useShiftsRuleCommands } from "@/hooks/shiftsCommands"

/** What is typed in the availability form. */
interface AvailabilityForm {
    readonly staffId: string
    readonly mode: string
    readonly weekday: string
    readonly date: string
    readonly start: string
    readonly end: string
    readonly available: boolean
}

const INITIAL_FORM: AvailabilityForm = {
    staffId: "",
    mode: "weekday",
    weekday: "0",
    date: "",
    start: "07:00",
    end: "22:00",
    available: false,
}
const LIST_LIMIT = 40

interface AvailabilityReadyInput {
    readonly t: ReturnType<typeof useTranslations<"shifts">>
    readonly format: ReturnType<typeof useShiftsFormat>
    readonly form: AvailabilityForm
    readonly setForm: React.Dispatch<React.SetStateAction<AvailabilityForm>>
    readonly operation: ReturnType<typeof useShiftsOperation>
    readonly commands: ReturnType<typeof useShiftsRuleCommands>
    readonly date: string
    readonly isWeekly: boolean
    readonly when: ReturnType<typeof useShiftsWhenFields>
    readonly bench: NonNullable<ShiftsPanelInput["bench"]["data"]>
    readonly staff: NonNullable<ShiftsPanelInput["bench"]["data"]>["setup"]["staff"]
    readonly staffId: string
}
const buildAvailabilityReady = (context: AvailabilityReadyInput): FullView => {
    const { t, format, form, setForm, operation, commands, date, isWeekly, when, bench, staff, staffId } = context
    const approved = bench.allAvailability.filter((row) => row.status === "approved").slice(0, LIST_LIMIT)

    const run = (job: () => Promise<boolean>) => operation.run("write", job)
    const add = () =>
        run(() =>
            commands.addAvailability({
                staffId,
                weekday: isWeekly ? Number(form.weekday) : null,
                date: isWeekly ? null : date,
                start: form.start,
                end: form.end,
                available: form.available,
            }),
        )
    const whenOf = (weekday: number | null, date: string | null): string =>
        date === null ? format.weekdayName(weekday ?? 0, "long") : format.dayMonth(date)

    const view: FullView = {
        props: {
            fields: [
                {
                    id: "staffId",
                    label: t("fStaff"),
                    value: staffId,
                    options: staff.map((person) => ({ id: person.id, label: person.name })),
                },
                ...when,
            ],
            canSubmit: staffId !== "",
            rows: approved.map((row) => ({
                id: row.id,
                text: `${staff.find((person) => person.id === row.staffId)?.name ?? "-"}: ${t(row.available ? "canWork" : "cannotWork")} ${whenOf(row.weekday, row.date)} ${row.start}-${row.end}`,
                badge: null,
                actionLabel: t("remove"),
            })),
        },
        on: {
            field: (id, value) => setForm((current) => ({ ...current, [id]: value })),
            available: (available) => setForm((current) => ({ ...current, available })),
            submit: () => operation.observe(add()),
            remove: (id) => operation.observe(run(() => commands.removeAvailability(id))),
        },
    }

    return view
}

type UseShiftsAvailabilityViewResult =
    | {
          copy: Omit<ShiftsSetupViews["availability"], "fields" | "rows" | "canSubmit">
          data: undefined
          on: undefined
      }
    | {
          copy: Omit<ShiftsSetupViews["availability"], "fields" | "rows" | "canSubmit">
          data: Pick<ShiftsSetupViews["availability"], "fields" | "rows" | "canSubmit">
          on: {
              readonly field: (id: string, value: string) => void
              readonly available: (value: boolean) => void
              readonly submit: () => void
              readonly remove: (id: string) => void
          }
      }

/** The availability of each person, entered by the manager: the form and the approved rows with remove. */
export const useShiftsAvailabilityView = (input: ShiftsPanelInput): UseShiftsAvailabilityViewResult => {
    const t = useTranslations("shifts")
    const format = useShiftsFormat()
    const commands = useShiftsRuleCommands()
    const bench = input.bench.data
    const staff = bench?.setup.staff ?? []
    const { form, setForm, operation, isBusy, date, isWeekly, when } = useShiftsAvailabilityDraft(
        input,
        INITIAL_FORM,
        bench?.today ?? "",
    )
    const staffId = form.staffId === "" ? (staff[0]?.id ?? "") : form.staffId

    const copy: ShiftsSetupViews["availabilityCopy"] = {
        fieldStructure: [
            { id: "staffId", label: t("fStaff"), control: "select" },
            ...when.map((field) => ({ id: field.id, label: field.label, control: "select" as const })),
        ],
        title: t("availMgrTitle"),
        hint: t("availMgrHint"),
        switchLabel: t(form.available ? "canWork" : "cannotWork"),
        switchOn: form.available,
        submitLabel: t("availAddBtn"),
        submitIntent: "neutral",
        isBusy,
    }

    if (bench === undefined || bench.role === "staff") return { copy, data: undefined, on: undefined }

    const view = buildAvailabilityReady({
        t,
        format,
        form,
        setForm,
        operation,
        commands,
        date,
        isWeekly,
        when,
        bench,
        staff,
        staffId,
    })
    return { copy, data: view.props, on: view.on }
}
