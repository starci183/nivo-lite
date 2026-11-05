"use client"

import useSWRMutation from "swr/mutation"
import type { SWRMutationResponse } from "swr/mutation"
import type { ReadVariables } from "@nivo-lite/agent-sdk/block"
import { answeredData } from "@/hooks/workspaceread"
import { valueOfJsonText } from "@/modules/workbench-host"
import { queryWorkbenchRead } from "@/modules/api"

/** The SWR key of the next-page read of a paged workbench read. */
export const QUERY_WORKBENCH_MORE_SWR_KEY = "QUERY_WORKBENCH_MORE_SWR"

/** What one next-page read takes: the read name and its variables with the cursor. */
interface TriggerArg {
    readonly arg: { readonly name: string; readonly variables: ReadVariables }
}

/** The next page of a paged workbench read: `trigger({ name, variables })` answers the page as the back end sent it and rejects with its failure. */
export const useQueryWorkbenchMoreSwr = (): SWRMutationResponse<
    unknown,
    Error,
    typeof QUERY_WORKBENCH_MORE_SWR_KEY,
    TriggerArg["arg"]
> =>
    useSWRMutation(QUERY_WORKBENCH_MORE_SWR_KEY, async (_key: string, { arg }: TriggerArg) =>
        valueOfJsonText(answeredData(await queryWorkbenchRead(arg), arg.name).workbenchRead.data),
    )
