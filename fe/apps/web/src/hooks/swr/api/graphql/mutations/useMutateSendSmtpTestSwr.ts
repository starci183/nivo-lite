import { useGraphQLMutationSwr } from "@/hooks/reuseables"
import { mutateSendSmtpTest } from "@/modules/api/graphql/mutations/mutation-send-smtp-test"

/** The SWR key of the sendSmtpTest mutation. */
export const MUTATE_SEND_SMTP_TEST_SWR_KEY = "MUTATE_SEND_SMTP_TEST_SWR"

/** SWR mutation for {@link mutateSendSmtpTest}: `trigger(input)` answers the payload and rejects with the back end failure. */
export const useMutateSendSmtpTestSwr = () =>
    useGraphQLMutationSwr(MUTATE_SEND_SMTP_TEST_SWR_KEY, mutateSendSmtpTest, (data) => data.sendSmtpTest)
