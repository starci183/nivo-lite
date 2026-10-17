"use client"

import { mutateSetContentAutomation } from "@/modules/api/graphql/mutations/mutation-set-content-automation"
import type { mutateSetContentAutomation as MutateSetContentAutomationOperation } from "@/modules/api/graphql/mutations/mutation-set-content-automation"
import useSWRMutation from "swr/mutation"
import { answeredData } from "@/hooks/workspaceread"

/** The SWR key of the setContentAutomation mutation. */
export const MUTATE_SET_CONTENT_AUTOMATION_SWR_KEY = "MUTATE_SET_CONTENT_AUTOMATION_SWR"

/** SWR mutation for {@link mutateSetContentAutomation}: `trigger(input)` answers the payload and rejects with the back end failure. */
export const useMutateSetContentAutomationSwr = () =>
    useSWRMutation(
        MUTATE_SET_CONTENT_AUTOMATION_SWR_KEY,
        async (_key: string, { arg }: TriggerArg) =>
            answeredData(await mutateSetContentAutomation({ request: arg }), MUTATE_SET_CONTENT_AUTOMATION_SWR_KEY)
                .setContentAutomation,
    )

/** The request accepted by this operation trigger. */
interface TriggerArg {
    readonly arg: Parameters<typeof MutateSetContentAutomationOperation>[0]["request"]
}
