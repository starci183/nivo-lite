import { useGraphQLMutationSwr } from "@/hooks/reuseables"
import { mutateSetDefaultSmtp } from "@/modules/api/graphql/mutations/mutation-set-default-smtp"

/** The SWR key of the setDefaultSmtp mutation. */
export const MUTATE_SET_DEFAULT_SMTP_SWR_KEY = "MUTATE_SET_DEFAULT_SMTP_SWR"

/** SWR mutation for {@link mutateSetDefaultSmtp}: `trigger(input)` answers the payload and rejects with the back end failure. */
export const useMutateSetDefaultSmtpSwr = () =>
    useGraphQLMutationSwr(MUTATE_SET_DEFAULT_SMTP_SWR_KEY, mutateSetDefaultSmtp, (data) => data.setDefaultSmtp)
