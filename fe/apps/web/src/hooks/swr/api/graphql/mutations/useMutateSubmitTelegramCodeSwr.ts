import useSWRMutation from "swr/mutation"
import { mutateSubmitTelegramCode } from "@/modules/api/graphql/mutations/mutation-submit-telegram-code"
import type { MutateSubmitTelegramCodeRequest } from "@/modules/api/graphql/mutations/mutation-submit-telegram-code"

/** What the submitTelegramCode mutation is triggered with. */
interface SubmitTelegramCodeArg {
    readonly arg: MutateSubmitTelegramCodeRequest
}

/** The SWR key of the submitTelegramCode mutation. */
export const MUTATE_SUBMIT_TELEGRAM_CODE_SWR_KEY = "MUTATE_SUBMIT_TELEGRAM_CODE_SWR"

/** SWR mutation for {@link mutateSubmitTelegramCode}: `trigger(input)` answers the payload and rejects with the back end failure. */
export const useMutateSubmitTelegramCodeSwr = () =>
    useSWRMutation(MUTATE_SUBMIT_TELEGRAM_CODE_SWR_KEY, async (_key: string, { arg }: SubmitTelegramCodeArg) => {
        const result = await mutateSubmitTelegramCode({ request: arg })
        if (result.data === undefined || result.data === null) throw new Error("submitTelegramCode answered no data")
        return result.data.submitTelegramCode
    })
