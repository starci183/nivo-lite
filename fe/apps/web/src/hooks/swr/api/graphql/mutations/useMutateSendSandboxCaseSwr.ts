"use client"

import {
    mutateSendSandboxCase,
    type MutateSendSandboxCaseRequest,
} from "@/modules/api/graphql/mutations/mutation-send-sandbox-case"
import { answeredData } from "@/hooks/workspaceread"
import useSWRMutation, { type SWRMutationResponse } from "swr/mutation"
import type { SendSandboxCaseMutation } from "@/modules/api"

/** The SWR key of the sendSandboxCase mutation. */
export const MUTATE_SEND_SANDBOX_CASE_SWR_KEY = "MUTATE_SEND_SANDBOX_CASE_SWR"

/** SWR mutation for {@link mutateSendSandboxCase}: Sends one inbound case of a sandbox account through the provider's own webhook route. `trigger(request)` answers the payload and rejects with the back end failure. */
export const useMutateSendSandboxCaseSwr = (): SWRMutationResponse<
    SendSandboxCaseMutation["sendSandboxCase"],
    Error,
    typeof MUTATE_SEND_SANDBOX_CASE_SWR_KEY,
    MutateSendSandboxCaseRequest
> =>
    useSWRMutation(
        MUTATE_SEND_SANDBOX_CASE_SWR_KEY,
        async (_key: string, { arg }: TriggerArg) =>
            answeredData(await mutateSendSandboxCase({ request: arg }), MUTATE_SEND_SANDBOX_CASE_SWR_KEY).sendSandboxCase,
    )

/** The request accepted by this operation trigger. */
interface TriggerArg {
    readonly arg: MutateSendSandboxCaseRequest
}
