"use client"

import { mutateSendZaloTestMessage } from "@/modules/api/graphql/mutations/mutation-send-zalo-test-message"
import type { mutateSendZaloTestMessage as MutateSendZaloTestMessageOperation } from "@/modules/api/graphql/mutations/mutation-send-zalo-test-message"
import useSWRMutation from "swr/mutation"
import { answeredData } from "@/hooks/workspaceread"

/** The SWR key of the sendZaloTestMessage mutation. */
export const MUTATE_SEND_ZALO_TEST_MESSAGE_SWR_KEY = "MUTATE_SEND_ZALO_TEST_MESSAGE_SWR_KEY"

/** SWR mutation for {@link mutateSendZaloTestMessage}: `trigger(input)` answers the payload and rejects with the back end failure. */
export const useMutateSendZaloTestMessageSwr = () =>
    useSWRMutation(
        MUTATE_SEND_ZALO_TEST_MESSAGE_SWR_KEY,
        async (_key: string, { arg }: TriggerArg) =>
            answeredData(await mutateSendZaloTestMessage({ request: arg }), MUTATE_SEND_ZALO_TEST_MESSAGE_SWR_KEY)
                .sendZaloTestMessage,
    )

/** The request accepted by this operation trigger. */
interface TriggerArg {
    readonly arg: Parameters<typeof MutateSendZaloTestMessageOperation>[0]["request"]
}
