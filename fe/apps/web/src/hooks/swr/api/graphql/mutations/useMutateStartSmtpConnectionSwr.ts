"use client"

import { mutateStartSmtpConnection } from "@/modules/api/graphql/mutations/mutation-start-smtp-connection"
import type { mutateStartSmtpConnection as MutateStartSmtpConnectionOperation } from "@/modules/api/graphql/mutations/mutation-start-smtp-connection"
import useSWRMutation from "swr/mutation"
import { answeredData } from "@/hooks/workspaceread"

/** The SWR key of the startSmtpConnection mutation. */
export const MUTATE_START_SMTP_CONNECTION_SWR_KEY = "MUTATE_START_SMTP_CONNECTION_SWR"

/** SWR mutation for {@link mutateStartSmtpConnection}: `trigger(input)` answers the payload and rejects with the back end failure. */
export const useMutateStartSmtpConnectionSwr = () =>
    useSWRMutation(
        MUTATE_START_SMTP_CONNECTION_SWR_KEY,
        async (_key: string, { arg }: TriggerArg) =>
            answeredData(await mutateStartSmtpConnection({ request: arg }), MUTATE_START_SMTP_CONNECTION_SWR_KEY)
                .startSmtpConnection,
    )

/** The request accepted by this operation trigger. */
interface TriggerArg {
    readonly arg: Parameters<typeof MutateStartSmtpConnectionOperation>[0]["request"]
}
