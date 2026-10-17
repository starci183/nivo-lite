"use client"

import { mutateSetDefaultSmtp } from "@/modules/api/graphql/mutations/mutation-set-default-smtp"
import type { mutateSetDefaultSmtp as MutateSetDefaultSmtpOperation } from "@/modules/api/graphql/mutations/mutation-set-default-smtp"
import useSWRMutation from "swr/mutation"
import { answeredData } from "@/hooks/workspaceread"

/** The SWR key of the setDefaultSmtp mutation. */
export const MUTATE_SET_DEFAULT_SMTP_SWR_KEY = "MUTATE_SET_DEFAULT_SMTP_SWR"

/** SWR mutation for {@link mutateSetDefaultSmtp}: `trigger(input)` answers the payload and rejects with the back end failure. */
export const useMutateSetDefaultSmtpSwr = () =>
    useSWRMutation(
        MUTATE_SET_DEFAULT_SMTP_SWR_KEY,
        async (_key: string, { arg }: TriggerArg) =>
            answeredData(await mutateSetDefaultSmtp({ request: arg }), MUTATE_SET_DEFAULT_SMTP_SWR_KEY).setDefaultSmtp,
    )

/** The request accepted by this operation trigger. */
interface TriggerArg {
    readonly arg: Parameters<typeof MutateSetDefaultSmtpOperation>[0]["request"]
}
