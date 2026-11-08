"use client"

import {
    mutateResendTelegramCode,
    type mutateResendTelegramCode as MutateResendTelegramCodeOperation,
} from "@/modules/api/graphql/mutations/mutation-resend-telegram-code"
import { answeredData } from "@/hooks/workspaceread"
import useSWRMutation, { type SWRMutationResponse } from "swr/mutation"
import type { ResendTelegramCodeMutation } from "@/modules/api"

/** The SWR key of the resendTelegramCode mutation. */
export const MUTATE_RESEND_TELEGRAM_CODE_SWR_KEY = "MUTATE_RESEND_TELEGRAM_CODE_SWR"

/** SWR mutation for {@link mutateResendTelegramCode}: `trigger(input)` answers the payload and rejects with the back end failure. */
export const useMutateResendTelegramCodeSwr = (): SWRMutationResponse<
    ResendTelegramCodeMutation["resendTelegramCode"],
    Error,
    typeof MUTATE_RESEND_TELEGRAM_CODE_SWR_KEY,
    TriggerArg["arg"]
> =>
    useSWRMutation(
        MUTATE_RESEND_TELEGRAM_CODE_SWR_KEY,
        async (_key: string, { arg }: TriggerArg) =>
            answeredData(await mutateResendTelegramCode({ request: arg }), MUTATE_RESEND_TELEGRAM_CODE_SWR_KEY)
                .resendTelegramCode,
    )

/** The request accepted by this operation trigger. */
interface TriggerArg {
    readonly arg: Parameters<typeof MutateResendTelegramCodeOperation>[0]["request"]
}
