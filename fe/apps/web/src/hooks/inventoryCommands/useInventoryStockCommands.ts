import { useMemo } from "react"
import { useMutateAdjustInventoryStockSwr } from "@/hooks/swr/api/graphql/mutations/useMutateAdjustInventoryStockSwr"
import { useMutateApplyInventoryStarterSwr } from "@/hooks/swr/api/graphql/mutations/useMutateApplyInventoryStarterSwr"
import { useMutateDraftInventoryLowStockSwr } from "@/hooks/swr/api/graphql/mutations/useMutateDraftInventoryLowStockSwr"
import { useMutateImportInventoryPasteSwr } from "@/hooks/swr/api/graphql/mutations/useMutateImportInventoryPasteSwr"
import { useMutateTakeInventoryStockSwr } from "@/hooks/swr/api/graphql/mutations/useMutateTakeInventoryStockSwr"
import { useMutateTransferInventoryStockSwr } from "@/hooks/swr/api/graphql/mutations/useMutateTransferInventoryStockSwr"
import type { InventoryStockCommands } from "./inventoryCommands.shared"
import { lineGroups } from "./inventoryCommands.shared"

/** The stock commands of the inventory workbench (import, starter, adjust, count, transfer, low-stock draft) through the back end GraphQL door. */
export const useInventoryStockCommands = (): InventoryStockCommands => {
    const { trigger: importPasteTrigger } = useMutateImportInventoryPasteSwr()
    const { trigger: applyStarterTrigger } = useMutateApplyInventoryStarterSwr()
    const adjustStockTrigger = useMutateAdjustInventoryStockSwr().trigger
    const { trigger: stockTakeTrigger } = useMutateTakeInventoryStockSwr()
    const { trigger: transferStockTrigger } = useMutateTransferInventoryStockSwr()
    const { trigger: draftLowStockTrigger } = useMutateDraftInventoryLowStockSwr()
    return useMemo<InventoryStockCommands>(
        () => ({
            importPaste: async (raw) => {
                const result = await importPasteTrigger({ raw })
                return { ...result, skipped: result.skipped.flat() }
            },
            applyStarter: (key) => applyStarterTrigger({ key }),
            adjustStock: async (input) => {
                const result = await adjustStockTrigger(input)
                return { state: result.state === "waiting" ? "waiting" : "applied" }
            },
            stockTake: async (counts) => {
                const result = await stockTakeTrigger({ counts: lineGroups(counts) })
                return { applied: result.applied, waiting: result.waiting, same: result.same }
            },
            transferStock: async (input) => {
                await transferStockTrigger(input)
                return null
            },
            draftLowStock: async () => draftLowStockTrigger(),
        }),
        [
            importPasteTrigger,
            applyStarterTrigger,
            adjustStockTrigger,
            stockTakeTrigger,
            transferStockTrigger,
            draftLowStockTrigger,
        ],
    )
}
