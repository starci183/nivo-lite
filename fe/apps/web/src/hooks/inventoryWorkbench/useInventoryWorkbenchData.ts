import { useQueryInventoryWorkbenchSwr } from "@/hooks/swr"
import { toInventoryWorkbenchData } from "./inventoryWorkbench.shared"
import { readError } from "@/hooks/workspaceread"

/**
 * The inventory workbench through SWR: `data` is `null` while the first read runs and `undefined` when it failed — the
 * connected block shows the failure notice in that case.
 */
export const useInventoryWorkbenchData = () => {
    const swrRead = useQueryInventoryWorkbenchSwr()
    const { data, isLoading } = swrRead
    const error = readError(swrRead)
    return {
        data: data === undefined ? undefined : toInventoryWorkbenchData(data),
        error,
        isLoading,
        reload: () => {
            void swrRead.mutate()
        },
    }
}
