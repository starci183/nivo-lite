import { useGraphQLMutationSwr } from "@/hooks/reuseables"
import { mutateChangeSmtpPassword } from "@/modules/api/graphql/mutations/mutation-change-smtp-password"

/** The SWR key of the changeSmtpPassword mutation. */
export const MUTATE_CHANGE_SMTP_PASSWORD_SWR_KEY = "MUTATE_CHANGE_SMTP_PASSWORD_SWR"

/** SWR mutation for {@link mutateChangeSmtpPassword}: `trigger(input)` answers the payload and rejects with the back end failure. */
export const useMutateChangeSmtpPasswordSwr = () =>
    useGraphQLMutationSwr(
        MUTATE_CHANGE_SMTP_PASSWORD_SWR_KEY,
        mutateChangeSmtpPassword,
        (data) => data.changeSmtpPassword,
    )
