import { useMemo } from "react"
import { useQueryHiringWorkbenchSwr } from "@/hooks/swr/api/graphql/queries/useQueryHiringWorkbenchSwr"
import { toHiringWorkbenchData } from "@/hooks/hiringMap"
import { isForbiddenFailure } from "@/modules/api"

/**
 * The Hiring workbench through SWR: `data` is `undefined` while the first read runs or when it failed. `isForbidden` tells a
 * caller who is not an owner or a manager (candidate files are personal data) from a read that simply failed.
 */
export const useHiringWorkbench = () => {
    const { data, error, isLoading } = useQueryHiringWorkbenchSwr()
    const mapped = useMemo(() => (data === undefined ? undefined : toHiringWorkbenchData(data)), [data])
    return { data: mapped, isLoading, isFailed: error !== undefined, isForbidden: isForbiddenFailure(error) }
}
