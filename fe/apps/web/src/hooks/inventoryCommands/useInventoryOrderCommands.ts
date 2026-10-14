"use client"

import { useMemo } from "react"
import {
    useMutateCancelInventoryPoSwr,
    useMutateCreateInventoryPoSwr,
    useMutateReceiveInventoryPoSwr,
    useMutateRequestInventorySendSwr,
    useMutateUpdateInventoryPoDraftSwr,
} from "@/hooks/swr"
import type { InventoryOrderCommands } from "./inventoryCommands.shared"

/** The purchase order commands of the inventory workbench through the back end GraphQL door. */
export const useInventoryOrderCommands = (): InventoryOrderCommands => {
    const { trigger: createPoTrigger } = useMutateCreateInventoryPoSwr()
    const { trigger: updatePoDraftTrigger } = useMutateUpdateInventoryPoDraftSwr()
    const { trigger: requestSendTrigger } = useMutateRequestInventorySendSwr()
    const { trigger: cancelPoTrigger } = useMutateCancelInventoryPoSwr()
    const { trigger: receivePoTrigger } = useMutateReceiveInventoryPoSwr()
    return useMemo<InventoryOrderCommands>(
        () => ({
            createPo: async (input) => await createPoTrigger({ ...input, lines: [...input.lines] }),
            updatePoDraft: async (input) => {
                await updatePoDraftTrigger({ ...input, lines: [...input.lines] })
                return null
            },
            requestSend: (poId, kind) => requestSendTrigger({ poId, kind }),
            cancelPo: async (poId) => {
                await cancelPoTrigger({ poId })
                return null
            },
            receivePo: async (input) => {
                const result = await receivePoTrigger({ ...input, lines: [...input.lines] })
                return {
                    status: result.status === "received" ? "received" : "partially_received",
                    priceChanges: result.priceChanges,
                    handedToAccounting: result.handedToAccounting,
                }
            },
        }),
        [createPoTrigger, updatePoDraftTrigger, requestSendTrigger, cancelPoTrigger, receivePoTrigger],
    )
}
