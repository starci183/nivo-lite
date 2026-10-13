import { useMemo } from "react"
import { EMPTY_BOARD, toHiringWorkbenchData } from "@/hooks/hiringMap"
import { useQueryHiringWorkbenchSwr } from "@/hooks/swr/api/graphql/queries/useQueryHiringWorkbenchSwr"
import { isForbiddenFailure } from "@/modules/api"

/**
 * The Hiring workbench through SWR, shared by every tab block (one cache entry). `board` is the empty board until the first read
 * lands, so a block can always draw; `isLoading`, `isFailed` and `isForbidden` (not an owner or a manager) say why it is empty.
 */
export const useHiringWorkbench = () => {
    const { data, error, isLoading } = useQueryHiringWorkbenchSwr()
    const mapped = useMemo(() => (data === undefined ? undefined : toHiringWorkbenchData(data)), [data])
    return {
        board: mapped ?? EMPTY_BOARD,
        hasBoard: mapped !== undefined,
        isLoading,
        isFailed: error !== undefined,
        isForbidden: isForbiddenFailure(error),
    }
}
