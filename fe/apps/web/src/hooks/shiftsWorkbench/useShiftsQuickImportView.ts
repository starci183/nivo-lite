import { useFeatureReset } from "@/hooks/reuseables"
import { useShiftsOperation } from "./useShiftsOperation"
import type { ShiftsSetupViews, ShiftsSetupActions } from "@/modules/types"
import type { ShiftsPanelInput } from "./shiftsWorkbench.shared"
type FullView = { readonly props: ShiftsSetupViews["quickImportData"]; readonly on: ShiftsSetupActions["quickImport"] }
type ImportField = ShiftsSetupViews["quickImportImportField"]
type ImportForm = ShiftsSetupViews["quickImportImportForm"]

import { useTranslations } from "next-intl"
import { useState } from "react"
import { useShiftsImportCommand } from "@/hooks/shiftsCommands"

const BLANK: ImportForm = { positions: "", staff: "", coverage: "" }

/** The quick import: positions, staff and coverage typed as plain lines and created in one go by the back end. */
export const useShiftsQuickImportView = (input: ShiftsPanelInput) => {
    const t = useTranslations("shifts")
    const bench = input.bench.data
    const importLines = useShiftsImportCommand()
    const [form, setForm] = useState<ImportForm>(BLANK)
    const operation = useShiftsOperation(input)
    const isBusy = operation.tag !== null
    useFeatureReset({
        isActive: input.isActive,
        isReady: true,
        scope: input.scope,
        onReset: () => {
            setForm(BLANK)
        },
    })

    const copy: ShiftsSetupViews["quickImportCopy"] = {
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
        canCreate: [form.positions, form.staff, form.coverage].some((text) => text.trim() !== ""),
    }

    if (bench === undefined || bench.role === "staff") return { copy, data: undefined, on: undefined }

    const create = async () => {
        const isCurrent = operation.capture()

        const done = await operation.run("write", () => importLines(form))
        if (done && isCurrent()) setForm(BLANK)
    }

    const view: FullView = {
        props: {},
        on: {
            change: (field: ImportField, value) => setForm((current) => ({ ...current, [field]: value })),
            create: () => operation.observe(create()),
        },
    }

    return { copy, data: view.props, on: view.on }
}
