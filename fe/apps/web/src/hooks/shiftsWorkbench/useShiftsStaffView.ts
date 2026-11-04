import { useFeatureReset } from "@/hooks/reuseables"
import { useShiftsOperation } from "./useShiftsOperation"
import type { ShiftsSetupViews, ShiftsSetupActions, ShiftsStaffView } from "@/modules/types"
import type { ShiftsPanelInput } from "./shiftsWorkbench.shared"

import { useTranslations } from "next-intl"
import { useState } from "react"
import { useShiftsBenchData, useShiftsFormat } from "@/hooks/shifts"
import { useShiftsSetupCommands } from "@/hooks/shiftsCommands"

type FullView = { readonly props: ShiftsSetupViews["staffData"]; readonly on: ShiftsSetupActions["staff"] }
type StaffForm = ShiftsSetupViews["staffStaffForm"]
type StaffTextField = ShiftsSetupViews["staffStaffTextField"]
type StaffNumberField = ShiftsSetupViews["staffStaffNumberField"]

/** State values and commands consumed by the connected surface. */
type ShiftsStaffControllerInput = {
    readonly t: ReturnType<typeof useTranslations<"shifts">>
    readonly bench: NonNullable<ReturnType<typeof useShiftsBenchData>>["data"]
    readonly format: ReturnType<typeof useShiftsFormat>
    readonly commands: ReturnType<typeof useShiftsSetupCommands>
    readonly form: StaffForm
    readonly setForm: React.Dispatch<React.SetStateAction<StaffForm>>
    readonly isBusy: boolean
    readonly operation: ReturnType<typeof useShiftsOperation>
}

/** Narrowed schedule data available after the access guard. */
type CreateShiftsStaffRowsInput = ShiftsStaffControllerInput & {
    bench: NonNullable<ShiftsStaffControllerInput["bench"]>
}

const BLANK: StaffForm = {
    id: null,
    name: "",
    positionIds: [],
    wage: 0,
    maxWeek: 48,
    maxDay: 10,
    minRest: 10,
    staffRowId: null,
    phone: "",
    telegramChatId: "",
    zaloUserId: "",
    active: true,
}

const NO_LINK = "none"

const formOf = (person: ShiftsStaffView): StaffForm => ({
    id: person.id,
    name: person.name,
    positionIds: [...person.positionIds],
    wage: person.wage,
    maxWeek: person.maxWeek,
    maxDay: person.maxDay,
    minRest: person.minRest,
    staffRowId: person.staffRowId,
    phone: person.phone ?? "",
    telegramChatId: person.telegramChatId ?? "",
    zaloUserId: person.zaloUserId ?? "",
    active: person.active,
})

const createShiftsStaffRows = (context: CreateShiftsStaffRowsInput) => {
    const { t, bench, format, commands, form, setForm, operation } = context

    const { staff, positions } = bench.setup
    const positionName = (id: string): string => positions.find((position) => position.id === id)?.name ?? ""

    const detailOf = (person: ShiftsStaffView): string => {
        const places = person.positionIds.map(positionName).join(", ") || t("noPosition")
        const channels = [
            person.telegramChatId === null ? "" : t("chTelegram"),
            person.zaloUserId === null ? "" : t("chZalo"),
        ]
        return [places, `${format.money(person.wage)}/h`, `${person.maxWeek}h/${t("perWeek")}`, ...channels]
            .filter((part) => part !== "")
            .join(" · ")
    }
    const save = async () => {
        const isCurrent = operation.capture()

        const done = await operation.run("write", () => commands.saveStaff(form))
        if (done && isCurrent()) setForm(BLANK)
    }
    return { ...context, staff, positions, detailOf, save }
}

const renderShiftsStaff = (context: ReturnType<typeof createShiftsStaffRows>): FullView => {
    const { t, bench, setForm, staff, positions, detailOf, save, operation } = context

    return {
        props: {
            people: staff.map((person) => ({
                id: person.id,
                title: person.active ? person.name : `${person.name} · ${t("inactive")}`,
                notes: [detailOf(person)],
            })),
            positionOptions: positions.map((position) => ({ value: position.id, label: position.name })),
            linkOptions: [
                { id: NO_LINK, label: t("fLinkNone") },
                ...bench.staffRows.map((row) => ({ id: row.id, label: row.name })),
            ],
        },
        on: {
            edit: (id) => {
                const person = staff.find((candidate) => candidate.id === id)
                if (person !== undefined) setForm(formOf(person))
            },
            text: (field: StaffTextField, value) => setForm((current) => ({ ...current, [field]: value })),
            number: (field: StaffNumberField, value) => setForm((current) => ({ ...current, [field]: value })),
            positions: (ids) => setForm((current) => ({ ...current, positionIds: ids })),
            link: (id) => setForm((current) => ({ ...current, staffRowId: id === NO_LINK ? null : id })),
            active: (value) => setForm((current) => ({ ...current, active: value })),
            save: () => operation.observe(save()),
            cancel: () => setForm(BLANK),
        },
    }
}

type UseShiftsStaffViewResult =
    | { copy: ShiftsSetupViews["staffCopy"]; data: undefined; on: undefined }
    | { copy: ShiftsSetupViews["staffCopy"]; data: FullView["props"]; on: FullView["on"] }

/** The roster: who works here, what they can do, their wage and limits, and the form to add or edit one person. */
export const useShiftsStaffView = (input: ShiftsPanelInput): UseShiftsStaffViewResult => {
    const t = useTranslations("shifts")
    const bench = input.bench.data
    const format = useShiftsFormat()
    const commands = useShiftsSetupCommands()
    const [form, setForm] = useState<StaffForm>(BLANK)
    const operation = useShiftsOperation(input)
    const isBusy = operation.tag !== null
    const state: ShiftsStaffControllerInput = { t, bench, format, commands, form, setForm, isBusy, operation }
    useFeatureReset({
        isActive: input.isActive,
        isReady: true,
        scope: input.scope,
        onReset: () => {
            setForm(BLANK)
        },
    })

    const copy: ShiftsSetupViews["staffCopy"] = {
        title: t("staffTitle"),
        hint: t("staffHint"),
        emptyTitle: t("staffNone"),
        emptyBody: t("staffNoneBody"),
        editLabel: t("edit"),
        formTitle: t(form.id === null ? "staffAdd" : "staffEdit"),
        saveLabel: t(form.id === null ? "staffAddBtn" : "save"),
        cancelLabel: t("cancel"),
        labels: {
            name: t("fName"),
            wage: t("fWage"),
            maxWeek: t("fMaxWeek"),
            maxDay: t("fMaxDay"),
            minRest: t("fRest"),
            phone: t("fPhone"),
            telegram: t("fTelegram"),
            zalo: t("fZalo"),
            link: t("fLink"),
            positions: t("fPositions"),
            active: t("fActive"),
        },
        form,
        noLinkId: NO_LINK,
        isBusy,
        canSave: form.name.trim() !== "",
    }

    if (bench === undefined || bench.role === "staff") return { copy, data: undefined, on: undefined }
    const view: FullView = renderShiftsStaff(createShiftsStaffRows({ ...state, bench }))
    return { copy, data: view.props, on: view.on }
}
