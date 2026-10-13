import { useQueryInventoryWorkbenchSwr } from "@/hooks/swr/api/graphql/queries/useQueryInventoryWorkbenchSwr"
import { toInventoryWorkbenchData } from "./inventoryWorkbench.shared"

/**
 * The inventory workbench through SWR: `data` is `null` while the first read runs and `undefined` when it failed — the
 * connected block shows the failure notice in that case.
 */
export const useInventoryWorkbenchData = () => {
    const { data, error, isLoading } = useQueryInventoryWorkbenchSwr()
    return {
        data: data === undefined ? undefined : toInventoryWorkbenchData(data),
        error,
        isLoading,
    }
}
