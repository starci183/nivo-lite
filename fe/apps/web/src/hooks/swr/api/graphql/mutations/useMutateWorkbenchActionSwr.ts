"use client"

import useSWRMutation from "swr/mutation"
import type { SWRMutationResponse } from "swr/mutation"
import type { JsonValue } from "@nivo-lite/agent-sdk/schema"
import { answeredData } from "@/hooks/workspaceread"
import { valueOfJsonText } from "@/modules/workbench-host"
import { mutateWorkbenchAction } from "@/modules/api/graphql/mutations/mutation-workbench-action"

/** The SWR key of the generic workbench action mutation. */
export const MUTATE_WORKBENCH_ACTION_SWR_KEY = "MUTATE_WORKBENCH_ACTION_SWR"

/** What one run takes: the action name and its flat payload. */
interface TriggerArg {
    readonly arg: { readonly name: string; readonly input: JsonValue }
}

/** One named action of the back end generic door: `trigger({ name, input })` answers the `ActionResult` JSON and rejects with the back end failure. */
export const useMutateWorkbenchActionSwr = (): SWRMutationResponse<
    unknown,
    Error,
    typeof MUTATE_WORKBENCH_ACTION_SWR_KEY,
    TriggerArg["arg"]
> =>
    useSWRMutation(MUTATE_WORKBENCH_ACTION_SWR_KEY, async (_key: string, { arg }: TriggerArg) =>
        valueOfJsonText(answeredData(await mutateWorkbenchAction(arg), arg.name).workbenchAction.data),
    )
