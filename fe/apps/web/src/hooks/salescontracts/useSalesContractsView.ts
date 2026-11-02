"use client"

import { useState } from "react"
import { useTranslations } from "next-intl"
import { useFeatureReset } from "@/hooks/reuseables"
import { vietnamDay } from "@/hooks/sales"
import { mapSlot, useSlotLabels } from "@/hooks/slot"
import type { useSalesWorkbench } from "@/hooks/salesworkbench"
import { useContractDrawer } from "./useContractDrawer"
import { useContractImport } from "./useContractImport"
import { useContractRows } from "./useContractRows"
import { useSalesContractImportView } from "./useSalesContractImportView"

/** The existing blank native row used while the contracts read is pending. */
const PLACEHOLDER_ROW = {
    id: "placeholder",
    title: "-",
    description: "-",
    statusLabel: "-",
    statusTone: "neutral",
    when: null,
} as const

/** Owns the recurring-contract list, local note and the two actual controlled editors in their former mount scope. */
export const useSalesContractsView = (
    workbench: ReturnType<typeof useSalesWorkbench>,
    isActive: boolean,
    scope: string,
) => {
    const t = useTranslations("workbenchSales")
    const labels = useSlotLabels()
    const [note, setNote] = useState("")
    useFeatureReset({ isActive, isReady: true, scope, onReset: () => setNote("") })
    const today = vietnamDay(workbench.nowIso)
    const rowOf = useContractRows(today)
    const importer = useContractImport(setNote, { isActive, scope })
    const editor = useContractDrawer({ leads: workbench.data?.leadOptions ?? [], today, setNote, isActive, scope })
    const importView = useSalesContractImportView(importer)
    return {
        props: {
            label: t("tab_contracts"),
            intro: t("contractsIntro"),
            addLabel: t("contractAdd"),
            importLabel: t("contractImport"),
            editLabel: t("contractEdit"),
            note,
            rows: mapSlot(workbench.slot, (data) => data.contracts.map(rowOf)),
            rowsPlaceholder: [PLACEHOLDER_ROW],
            rowsLabels: labels(t("contractsEmptyTitle")),
            drawer: editor.drawer,
            importDialog: importView.dialog,
        },
        on: {
            retry: workbench.retry,
            add: () => editor.open(null),
            openImport: importer.open,
            edit: (contractId: string) =>
                editor.open(workbench.data?.contracts.find((contract) => contract.id === contractId) ?? null),
            drawer: editor.on,
            import: importView.on,
        },
    }
}
