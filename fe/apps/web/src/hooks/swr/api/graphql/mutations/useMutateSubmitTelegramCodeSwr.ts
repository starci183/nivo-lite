"use client"

import { mutateSubmitTelegramCode } from "@/modules/api/graphql/mutations/mutation-submit-telegram-code"
import type { mutateSubmitTelegramCode as MutateSubmitTelegramCodeOperation } from "@/modules/api/graphql/mutations/mutation-submit-telegram-code"
import useSWRMutation from "swr/mutation"
import { answeredData } from "@/hooks/workspaceread"

/** The SWR key of the submitTelegramCode mutation. */
export const MUTATE_SUBMIT_TELEGRAM_CODE_SWR_KEY = "MUTATE_SUBMIT_TELEGRAM_CODE_SWR"

/** SWR mutation for {@link mutateSubmitTelegramCode}: `trigger(input)` answers the payload and rejects with the back end failure. */
export const useMutateSubmitTelegramCodeSwr = () =>
    useSWRMutation(
        MUTATE_SUBMIT_TELEGRAM_CODE_SWR_KEY,
        async (_key: string, { arg }: TriggerArg) =>
            answeredData(await mutateSubmitTelegramCode({ request: arg }), MUTATE_SUBMIT_TELEGRAM_CODE_SWR_KEY)
                .submitTelegramCode,
    )

/** The request accepted by this operation trigger. */
interface TriggerArg {
    readonly arg: Parameters<typeof MutateSubmitTelegramCodeOperation>[0]["request"]
}
