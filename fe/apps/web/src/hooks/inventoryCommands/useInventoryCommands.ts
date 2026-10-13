import { useMemo } from "react"
import { DECODERS, decoded, nothing, starterJson } from "./inventoryCommands.shared"
import type { InventoryCommands, InventorySend } from "./inventoryCommands.shared"

/** The commands of one workspace over the one Server Action the connected block hands in. */
export const useInventoryCommands = (workspaceId: string, send: InventorySend): InventoryCommands =>
    useMemo<InventoryCommands>(
        () => ({
            saveItem: async (input) => decoded(await send(workspaceId, "save-item", { ...input }), DECODERS.saved),
            setItemActive: async (id, active) => nothing(await send(workspaceId, "set-item-active", { id, active })),
            saveSupplier: async (input) =>
                decoded(await send(workspaceId, "save-supplier", { ...input }), DECODERS.saved),
            saveRecipe: async (input) =>
                decoded(
                    await send(workspaceId, "save-recipe", {
                        ...input,
                        lines: input.lines.map((line) => ({ ...line })),
                    }),
                    DECODERS.saved,
                ),
            deleteRecipe: async (id) => nothing(await send(workspaceId, "delete-recipe", { id })),
            saveLocation: async (name) => nothing(await send(workspaceId, "save-location", { name })),
            importPaste: async (raw) => decoded(await send(workspaceId, "import-paste", { raw }), DECODERS.importPaste),
            applyStarter: async (input) =>
                decoded(await send(workspaceId, "apply-starter", starterJson(input)), DECODERS.starter),
            adjustStock: async (input) =>
                decoded(await send(workspaceId, "adjust-stock", { ...input }), DECODERS.adjust),
            stockTake: async (counts) =>
                decoded(
                    await send(workspaceId, "stock-take", { counts: counts.map((line) => ({ ...line })) }),
                    DECODERS.stockTake,
                ),
            transferStock: async (input) => nothing(await send(workspaceId, "transfer-stock", { ...input })),
            draftLowStock: async () => decoded(await send(workspaceId, "draft-low-stock", {}), DECODERS.draftLow),
            createPo: async (input) =>
                decoded(
                    await send(workspaceId, "create-po", { ...input, lines: input.lines.map((line) => ({ ...line })) }),
                    DECODERS.saved,
                ),
            updatePoDraft: async (input) =>
                nothing(
                    await send(workspaceId, "update-po-draft", {
                        ...input,
                        lines: input.lines.map((line) => ({ ...line })),
                    }),
                ),
            requestSend: async (poId, kind) =>
                decoded(await send(workspaceId, "request-send", { poId, kind }), DECODERS.send),
            cancelPo: async (poId) => nothing(await send(workspaceId, "cancel-po", { poId })),
            receivePo: async (input) =>
                decoded(
                    await send(workspaceId, "receive-po", {
                        ...input,
                        lines: input.lines.map((line) => ({ ...line })),
                    }),
                    DECODERS.receive,
                ),
        }),
        [workspaceId, send],
    )
