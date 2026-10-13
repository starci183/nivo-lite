import { useMemo } from "react"
import { useMutateCancelInventoryPoSwr } from "@/hooks/swr/api/graphql/mutations/useMutateCancelInventoryPoSwr"
import { useMutateCreateInventoryPoSwr } from "@/hooks/swr/api/graphql/mutations/useMutateCreateInventoryPoSwr"
import { useMutateReceiveInventoryPoSwr } from "@/hooks/swr/api/graphql/mutations/useMutateReceiveInventoryPoSwr"
import { useMutateRequestInventorySendSwr } from "@/hooks/swr/api/graphql/mutations/useMutateRequestInventorySendSwr"
import { useMutateUpdateInventoryPoDraftSwr } from "@/hooks/swr/api/graphql/mutations/useMutateUpdateInventoryPoDraftSwr"
import type { InventoryOrderCommands } from "./inventoryCommands.shared"
import { lineGroups } from "./inventoryCommands.shared"

/** The purchase order commands of the inventory workbench through the back end GraphQL door. */
export const useInventoryOrderCommands = (): InventoryOrderCommands => {
    const { trigger: createPoTrigger } = useMutateCreateInventoryPoSwr()
    const { trigger: updatePoDraftTrigger } = useMutateUpdateInventoryPoDraftSwr()
    const { trigger: requestSendTrigger } = useMutateRequestInventorySendSwr()
    const { trigger: cancelPoTrigger } = useMutateCancelInventoryPoSwr()
    const { trigger: receivePoTrigger } = useMutateReceiveInventoryPoSwr()
    return useMemo<InventoryOrderCommands>(
        () => ({
            createPo: async (input) => createPoTrigger({ ...input, lines: lineGroups(input.lines) }),
            updatePoDraft: async (input) => {
                await updatePoDraftTrigger({ ...input, lines: lineGroups(input.lines) })
                return null
            },
            requestSend: (poId, kind) => requestSendTrigger({ poId, kind }),
            cancelPo: async (poId) => {
                await cancelPoTrigger({ poId })
                return null
            },
            receivePo: async (input) => {
                const result = await receivePoTrigger({ ...input, lines: lineGroups(input.lines) })
                return {
                    status: result.status === "received" ? "received" : "partially_received",
                    priceChanges: result.priceChanges.flat(),
                    handedToAccounting: result.handedToAccounting,
                }
            },
        }),
        [createPoTrigger, updatePoDraftTrigger, requestSendTrigger, cancelPoTrigger, receivePoTrigger],
    )
}
