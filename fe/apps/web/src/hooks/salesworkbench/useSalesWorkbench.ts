import { useMemo } from "react"
import { useQuerySalesWorkbenchSwr } from "@/hooks/swr/api/graphql/queries/useQuerySalesWorkbenchSwr"
import { useActiveWorkspace } from "@/hooks/workspaces"
import { salesWorkbenchViewOf } from "./salesworkbench.shared"

/** The clock the workbench falls back to while it has not been read: the tabs that need it show no rows yet. */
const NOT_READ_ISO = new Date(0).toISOString()

/** The Sales workbench of the active workspace, read once through the shared SWR cache and mapped to the display model. */
export const useSalesWorkbench = () => {
    const { activeWorkspaceId } = useActiveWorkspace()
    const query = useQuerySalesWorkbenchSwr(activeWorkspaceId)
    const data = useMemo(() => (query.data === undefined ? null : salesWorkbenchViewOf(query.data)), [query.data])
    return {
        /** Everything the workbench shows; null while loading or when the read failed. */
        data,
        nowIso: data?.nowIso ?? NOT_READ_ISO,
        isLoading: query.isLoading,
        retry: () => {
            void query.mutate()
        },
    }
}
