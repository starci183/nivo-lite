"use client"

import {
    mutateSendSmtpTest,
    type MutateSendSmtpTestRequest,
} from "@/modules/api/graphql/mutations/mutation-send-smtp-test"
import useSWRMutation, { type SWRMutationResponse } from "swr/mutation"
import { answeredData } from "@/hooks/workspaceread"
import type { SendSmtpTestMutation } from "@/modules/api"

/** The SWR key of the sendSmtpTest mutation. */
export const MUTATE_SEND_SMTP_TEST_SWR_KEY = "MUTATE_SEND_SMTP_TEST_SWR"

/** SWR mutation for {@link mutateSendSmtpTest}: `trigger(input)` answers the payload and rejects with the back end failure. */
export const useMutateSendSmtpTestSwr = (): SWRMutationResponse<
    SendSmtpTestMutation["sendSmtpTest"],
    Error,
    typeof MUTATE_SEND_SMTP_TEST_SWR_KEY,
    TriggerArg["arg"]
> =>
    useSWRMutation(
        MUTATE_SEND_SMTP_TEST_SWR_KEY,
        async (_key: string, { arg }: TriggerArg) =>
            answeredData(await mutateSendSmtpTest({ request: arg }), MUTATE_SEND_SMTP_TEST_SWR_KEY).sendSmtpTest,
    )

/** The request accepted by this operation trigger. */
interface TriggerArg {
    readonly arg: MutateSendSmtpTestRequest
}
