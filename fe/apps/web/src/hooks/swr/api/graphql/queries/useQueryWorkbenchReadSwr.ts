"use client"

import { tenantParamsKey } from "@starci/next-data"
import useSWR, { type SWRResponse } from "swr"
import type { ReadVariables } from "@nivo-lite/agent-sdk/block"
import { answeredData } from "@/hooks/workspaceread"
import { queryWorkbenchRead } from "@/modules/api/graphql/queries/query-workbench-read"
import { WORKBENCH_READ_KEY, valueOfJsonText } from "@/modules/workbench-host"
import { useOpenWorkspaceId } from "@/hooks/workspaceKey"

/** One named read of the back end generic door, in the active workspace: `[name, workspace, operation, variables]`; null variables do not fetch. */
export const useQueryWorkbenchReadSwr = (
    operation: string,
    variables: ReadVariables | null,
): SWRResponse<unknown, Error> => {
    const workspaceId = useOpenWorkspaceId()
    const key = tenantParamsKey(WORKBENCH_READ_KEY, workspaceId, variables === null ? null : [operation, variables])
    return useSWR(key, async ([, , name, bound]) =>
        valueOfJsonText(answeredData(await queryWorkbenchRead({ name, variables: bound }), name).workbenchRead.data),
    )
}
