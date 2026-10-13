"use client"

import { useTranslations } from "next-intl"
import { useState } from "react"
import { useShiftsFormat } from "@/hooks/shifts"
import { useShiftsSetupCommands } from "@/hooks/shiftsCommands"
import type { ShiftsBenchView, ShiftsStaffView } from "@/modules/types"
import { ShiftsStaffBase } from "./component"
import type { StaffForm, StaffNumberField, StaffTextField } from "./component"

/** The bench whose roster is listed and edited. */
interface ShiftsStaffProps {
    readonly bench: ShiftsBenchView
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

/** The roster: who works here, what they can do, their wage and limits, and the form to add or edit one person. */
export const ShiftsStaff = (props: ShiftsStaffProps) => {
    const t = useTranslations("shifts")
    const format = useShiftsFormat()
    const commands = useShiftsSetupCommands()
    const [form, setForm] = useState<StaffForm>(BLANK)
    const [isBusy, setIsBusy] = useState(false)
    const { staff, positions } = props.bench.setup
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
        setIsBusy(true)
        const done = await commands.saveStaff(form)
        setIsBusy(false)
        if (done) setForm(BLANK)
    }

    return (
        <ShiftsStaffBase
            props={{
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
                people: staff.map((person) => ({
                    id: person.id,
                    title: person.active ? person.name : `${person.name} · ${t("inactive")}`,
                    notes: [detailOf(person)],
                })),
                form,
                positionOptions: positions.map((position) => ({ value: position.id, label: position.name })),
                linkOptions: [
                    { id: NO_LINK, label: t("fLinkNone") },
                    ...props.bench.staffRows.map((row) => ({ id: row.id, label: row.name })),
                ],
                noLinkId: NO_LINK,
                isBusy,
                canSave: form.name.trim() !== "",
            }}
            on={{
                edit: (id) => {
                    const person = staff.find((candidate) => candidate.id === id)
                    if (person !== undefined) setForm(formOf(person))
                },
                text: (field: StaffTextField, value) => setForm((current) => ({ ...current, [field]: value })),
                number: (field: StaffNumberField, value) => setForm((current) => ({ ...current, [field]: value })),
                positions: (ids) => setForm((current) => ({ ...current, positionIds: ids })),
                link: (id) => setForm((current) => ({ ...current, staffRowId: id === NO_LINK ? null : id })),
                active: (value) => setForm((current) => ({ ...current, active: value })),
                save: () => void save(),
                cancel: () => setForm(BLANK),
            }}
        />
    )
}
