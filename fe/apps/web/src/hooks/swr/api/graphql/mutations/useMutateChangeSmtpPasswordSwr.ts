"use client"

import {
    mutateChangeSmtpPassword,
    type mutateChangeSmtpPassword as MutateChangeSmtpPasswordOperation,
} from "@/modules/api/graphql/mutations/mutation-change-smtp-password"
import { answeredData } from "@/hooks/workspaceread"
import useSWRMutation, { type SWRMutationResponse } from "swr/mutation"
import type { ChangeSmtpPasswordMutation } from "@/modules/api"

/** The SWR key of the changeSmtpPassword mutation. */
export const MUTATE_CHANGE_SMTP_PASSWORD_SWR_KEY = "MUTATE_CHANGE_SMTP_PASSWORD_SWR"

/** SWR mutation for {@link mutateChangeSmtpPassword}: `trigger(input)` answers the payload and rejects with the back end failure. */
export const useMutateChangeSmtpPasswordSwr = (): SWRMutationResponse<
    ChangeSmtpPasswordMutation["changeSmtpPassword"],
    Error,
    typeof MUTATE_CHANGE_SMTP_PASSWORD_SWR_KEY,
    TriggerArg["arg"]
> =>
    useSWRMutation(
        MUTATE_CHANGE_SMTP_PASSWORD_SWR_KEY,
        async (_key: string, { arg }: TriggerArg) =>
            answeredData(await mutateChangeSmtpPassword({ request: arg }), MUTATE_CHANGE_SMTP_PASSWORD_SWR_KEY)
                .changeSmtpPassword,
    )

/** The request accepted by this operation trigger. */
interface TriggerArg {
    readonly arg: Parameters<typeof MutateChangeSmtpPasswordOperation>[0]["request"]
}
