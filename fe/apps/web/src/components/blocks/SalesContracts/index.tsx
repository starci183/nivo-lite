"use client"

import { useFormatter, useTranslations } from "next-intl"
import { useState } from "react"
import { vietnamDay } from "@/hooks/sales"
import { contractImportEvents, createContractImportDialog } from "@/components/composites/ContractImportDialog"
import {
    type ContractImport,
    CONTRACT_IMPORT_FIELDS,
    CONTRACT_TONES,
    contractStatusOf,
    isoDayText,
    useContractDrawer,
    useContractImport,
    useContractRows,
} from "@/hooks/salescontracts"
import { useSalesWorkbench } from "@/hooks/salesworkbench"
import { mapSlot, useSlotLabels } from "@/hooks/slot"
import { SalesContractsBase } from "./component"

/** The import dialog commands under the names the contracts surface hands them on. */
const importEventsOf = (importer: ContractImport) => {
    const on = contractImportEvents(importer)
    return {
        importSource: on.source,
        importFile: on.file,
        importPaste: on.paste,
        importPreview: on.preview,
        importSheet: on.sheet,
        importColumn: on.column,
        importConfirm: on.confirm,
        importClose: on.close,
    }
}

/** One blank row: the skeleton draws the same list as the ready one. */
const PLACEHOLDER_ROW = {
    id: "placeholder",
    title: "-",
    description: "-",
    statusLabel: "-",
    statusTone: "neutral",
    when: null,
} as const

/** The contracts surface: the slot of the contracts, which contract the drawer edits, its form, the save and the note after it live here; the drawing in the pure half. */
export const SalesContracts = () => {
    const t = useTranslations("workbenchSales")
    const format = useFormatter()
    const slotLabels = useSlotLabels()
    const { data, nowIso, slot, retry } = useSalesWorkbench()
    const [note, setNote] = useState("")
    const today = vietnamDay(nowIso)
    const rowOf = useContractRows(today)
    const importer = useContractImport(setNote)
    const editor = useContractDrawer({ leads: data?.leadOptions ?? [], today, setNote })

    return (
        <SalesContractsBase
            props={{
                label: t("tab_contracts"),
                intro: t("contractsIntro"),
                addLabel: t("contractAdd"),
                importLabel: t("contractImport"),
                editLabel: t("contractEdit"),
                note,
                rows: mapSlot(slot, (workbench) => workbench.contracts.map(rowOf)),
                rowsPlaceholder: [PLACEHOLDER_ROW],
                rowsLabels: slotLabels(t("contractsEmptyTitle")),
                drawer: editor.drawer,
                importDialog: createContractImportDialog({ t, format }, importer, {
                    fields: CONTRACT_IMPORT_FIELDS,
                    isoDayText,
                    contractTones: CONTRACT_TONES,
                    statusOf: contractStatusOf,
                }),
            }}
            on={{
                retry,
                add: () => editor.open(null),
                openImport: importer.open,
                ...importEventsOf(importer),
                edit: (contractId) =>
                    editor.open(data?.contracts.find((contract) => contract.id === contractId) ?? null),
                ...editor.on,
            }}
        />
    )
}
