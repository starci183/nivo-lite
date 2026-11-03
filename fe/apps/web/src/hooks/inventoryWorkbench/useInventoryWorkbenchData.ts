import { mapSlot, slotOfSwr } from "@/hooks/slot"
import { useQueryInventoryWorkbenchSwr } from "@/hooks/swr"
import { toInventoryWorkbenchData } from "@/modules/inventory"
import { readError } from "@/hooks/workspaceread"

/**
 * The inventory workbench through SWR: `data` is `null` while the first read runs and `undefined` when it failed — the
 * connected block shows the failure notice in that case.
 */
export const useInventoryWorkbenchData = (isActive = true) => {
    const swrRead = useQueryInventoryWorkbenchSwr(isActive)
    const { data, isLoading } = swrRead
    const error = readError(swrRead)
    return {
        read: swrRead,
        slot: mapSlot(slotOfSwr(swrRead), toInventoryWorkbenchData),
        data: data === undefined ? undefined : toInventoryWorkbenchData(data),
        error,
        isLoading,
        reload: () => swrRead.mutate(),
    }
}
