import { useMemo } from "react"
import type { Json } from "../../../../../../supabase/types/database.types"
import { DECODERS, decoded, nothing, starterJson } from "./inventoryCommands.shared"
import type { InventoryCommands, InventorySend } from "./inventoryCommands.shared"

/** The commands of one workspace over the one Server Action the connected block hands in. */
export const useInventoryCommands = (workspaceId: string, send: InventorySend): InventoryCommands =>
    useMemo<InventoryCommands>(() => {
        const submit = (kind: string, input: Json) => send({ workspaceId, kind, input })
        return {
            saveItem: async (input) => decoded(await submit("save-item", { ...input }), DECODERS.saved),
            setItemActive: async (id, active) => nothing(await submit("set-item-active", { id, active })),
            saveSupplier: async (input) => decoded(await submit("save-supplier", { ...input }), DECODERS.saved),
            saveRecipe: async (input) =>
                decoded(
                    await submit("save-recipe", { ...input, lines: input.lines.map((line) => ({ ...line })) }),
                    DECODERS.saved,
                ),
            deleteRecipe: async (id) => nothing(await submit("delete-recipe", { id })),
            saveLocation: async (name) => nothing(await submit("save-location", { name })),
            importPaste: async (raw) => decoded(await submit("import-paste", { raw }), DECODERS.importPaste),
            applyStarter: async (input) => decoded(await submit("apply-starter", starterJson(input)), DECODERS.starter),
            adjustStock: async (input) => decoded(await submit("adjust-stock", { ...input }), DECODERS.adjust),
            stockTake: async (counts) =>
                decoded(
                    await submit("stock-take", { counts: counts.map((line) => ({ ...line })) }),
                    DECODERS.stockTake,
                ),
            transferStock: async (input) => nothing(await submit("transfer-stock", { ...input })),
            draftLowStock: async () => decoded(await submit("draft-low-stock", {}), DECODERS.draftLow),
            createPo: async (input) =>
                decoded(
                    await submit("create-po", { ...input, lines: input.lines.map((line) => ({ ...line })) }),
                    DECODERS.saved,
                ),
            updatePoDraft: async (input) =>
                nothing(await submit("update-po-draft", { ...input, lines: input.lines.map((line) => ({ ...line })) })),
            requestSend: async (poId, kind) => decoded(await submit("request-send", { poId, kind }), DECODERS.send),
            cancelPo: async (poId) => nothing(await submit("cancel-po", { poId })),
            receivePo: async (input) =>
                decoded(
                    await submit("receive-po", { ...input, lines: input.lines.map((line) => ({ ...line })) }),
                    DECODERS.receive,
                ),
        }
    }, [workspaceId, send])
