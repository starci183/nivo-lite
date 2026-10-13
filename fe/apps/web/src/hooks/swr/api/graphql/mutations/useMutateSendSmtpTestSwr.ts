import useSWRMutation from "swr/mutation"
import { mutateSendSmtpTest } from "@/modules/api/graphql/mutations/mutation-send-smtp-test"
import type { MutateSendSmtpTestRequest } from "@/modules/api/graphql/mutations/mutation-send-smtp-test"

/** What the sendSmtpTest mutation is triggered with. */
interface SendSmtpTestArg {
    readonly arg: MutateSendSmtpTestRequest
}

/** The SWR key of the sendSmtpTest mutation. */
export const MUTATE_SEND_SMTP_TEST_SWR_KEY = "MUTATE_SEND_SMTP_TEST_SWR"

/** SWR mutation for {@link mutateSendSmtpTest}: `trigger(input)` answers the payload and rejects with the back end failure. */
export const useMutateSendSmtpTestSwr = () =>
    useSWRMutation(MUTATE_SEND_SMTP_TEST_SWR_KEY, async (_key: string, { arg }: SendSmtpTestArg) => {
        const result = await mutateSendSmtpTest({ request: arg })
        if (result.data === undefined || result.data === null) throw new Error("sendSmtpTest answered no data")
        return result.data.sendSmtpTest
    })
