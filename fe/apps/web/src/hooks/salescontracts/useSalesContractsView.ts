"use client"

import { useState } from "react"
import { useTranslations } from "next-intl"
import { useFeatureReset } from "@/hooks/reuseables"
import { vietnamDay, type useSalesWorkbench } from "@/hooks/sales"
import { mapSlot, useSlotLabels } from "@/hooks/slot"
import { useContractDrawer } from "./useContractDrawer"
import { useContractImport } from "./useContractImport"
import { useContractRows } from "./useContractRows"
import { useSalesContractImportView } from "./useSalesContractImportView"

import type {
    DataSlot,
    SlotLabels,
    SalesContractStatus,
    ContractImportDialogView,
    ContractImportDialogEvents,
} from "@/modules/types"
import type { ContractRow } from "./useContractRows"

/** The existing blank native row used while the contracts read is pending. */
const PLACEHOLDER_ROW = {
    id: "placeholder",
    title: "-",
    description: "-",
    statusLabel: "-",
    statusTone: "neutral",
    when: null,
} as const

type UseSalesContractsViewResult = {
    props: {
        label: string
        intro: string
        addLabel: string
        importLabel: string
        editLabel: string
        note: string
        rows: DataSlot<ContractRow[]>
        rowsPlaceholder: {
            readonly id: "placeholder"
            readonly title: "-"
            readonly description: "-"
            readonly statusLabel: "-"
            readonly statusTone: "neutral"
            readonly when: null
        }[]
        rowsLabels: SlotLabels
        drawer: {
            title: string
            closeLabel: string
            saveLabel: string
            cancelLabel: string
            leadLabel: string
            leadOptions: {
                id: string
                label: string
            }[]
            lead: string
            customerLabel: string
            customer: string
            planLabel: string
            planHint: string
            plan: string
            startLabel: string
            start: string
            endLabel: string
            endHint: string
            end: string
            amountLabel: string
            amount: string
            statusLabel: string
            statusOptions: {
                id: SalesContractStatus
                label: string
            }[]
            status: SalesContractStatus
            noteLabel: string
            note: string
            error: string | null
            isPending: boolean
            canSave: boolean
        } | null
        importDialog: ContractImportDialogView | null
    }
    on: {
        retry: () => void
        add: () => void
        openImport: () => void
        edit: (contractId: string) => void
        drawer: {
            lead: (value: string) => void
            customer: (value: string) => void
            plan: (value: string) => void
            start: (value: string) => void
            end: (value: string) => void
            amount: (value: string) => void
            status: (value: string) => void
            note: (value: string) => void
            submit: () => void
            close: () => void
        }
        import: ContractImportDialogEvents
    }
}

/** Owns the recurring-contract list, local note and the two actual controlled editors in their former mount scope. */
export const useSalesContractsView = (
    workbench: ReturnType<typeof useSalesWorkbench>,
    isActive: boolean,
    scope: string,
): UseSalesContractsViewResult => {
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
            add: (): void => editor.open(null),
            openImport: importer.open,
            edit: (contractId: string): void =>
                editor.open(workbench.data?.contracts.find((contract) => contract.id === contractId) ?? null),
            drawer: editor.on,
            import: importView.on,
        },
    }
}
