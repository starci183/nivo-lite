"use client"

import { useTranslations } from "next-intl"
import { useState } from "react"
import { useShiftsImportCommand } from "@/hooks/shiftsCommands"
import { ShiftsQuickImportBase } from "./component"
import type { ImportField, ImportForm } from "./component"

const BLANK: ImportForm = { positions: "", staff: "", coverage: "" }

/** The quick import: positions, staff and coverage typed as plain lines and created in one go by the back end. */
export const ShiftsQuickImport = () => {
    const t = useTranslations("shifts")
    const importLines = useShiftsImportCommand()
    const [form, setForm] = useState<ImportForm>(BLANK)
    const [isBusy, setIsBusy] = useState(false)

    const create = async () => {
        setIsBusy(true)
        const done = await importLines(form)
        setIsBusy(false)
        if (done) setForm(BLANK)
    }

    return (
        <ShiftsQuickImportBase
            props={{
                title: t("quickTitle"),
                hint: t("quickHint"),
                createLabel: t("quickCreate"),
                fields: [
                    {
                        id: "positions",
                        label: t("quickPositions"),
                        hint: t("quickPositionsHint"),
                        placeholder: t("quickPositionsPlaceholder"),
                        rows: 3,
                    },
                    {
                        id: "staff",
                        label: t("quickStaff"),
                        hint: t("quickStaffHint"),
                        placeholder: t("quickStaffPlaceholder"),
                        rows: 5,
                    },
                    {
                        id: "coverage",
                        label: t("quickCoverage"),
                        hint: t("quickCoverageHint"),
                        placeholder: t("quickCoveragePlaceholder"),
                        rows: 5,
                    },
                ],
                form,
                isBusy,
                canCreate: Object.values(form).some((text) => text.trim() !== ""),
            }}
            on={{
                change: (field: ImportField, value) => setForm((current) => ({ ...current, [field]: value })),
                create: () => void create(),
            }}
        />
    )
}
