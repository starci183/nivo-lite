import { queryContentWorkbench } from "@/modules/api/graphql/queries/query-content-workbench"
import { useWorkspaceQuerySwr } from "@/hooks/reuseables"

/** The SWR key of the contentWorkbench query. */
export const QUERY_CONTENT_WORKBENCH_SWR_KEY = "QUERY_CONTENT_WORKBENCH_SWR"

/** Everything the content workbench shows about the workspace. */
export const useQueryContentWorkbenchSwr = () =>
    useWorkspaceQuerySwr(
        QUERY_CONTENT_WORKBENCH_SWR_KEY,
        [],
        () => queryContentWorkbench(),
        (data) => data.contentWorkbench,
    )
