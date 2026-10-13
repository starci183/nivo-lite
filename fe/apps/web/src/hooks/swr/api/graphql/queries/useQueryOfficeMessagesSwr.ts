import type { SWRConfiguration } from "swr"
import { useGraphqlQuerySwr } from "@/hooks/reuseables"
import { queryOfficeMessages } from "@/modules/api/graphql/queries/query-office-messages"
import type { QueryOfficeMessagesRequest } from "@/modules/api/graphql/queries/query-office-messages"

/** The SWR key of {@link useQueryOfficeMessagesSwr}. */
export const QUERY_OFFICE_MESSAGES_SWR_KEY = "QUERY_OFFICE_MESSAGES_SWR"

/** The back end `officeMessages` query. Pass `null` to wait for the arguments. */
export const useQueryOfficeMessagesSwr = (request: QueryOfficeMessagesRequest | null, config?: SWRConfiguration) =>
    useGraphqlQuerySwr(
        QUERY_OFFICE_MESSAGES_SWR_KEY,
        request,
        (input) => queryOfficeMessages({ request: input }),
        (data) => data.officeMessages,
        config,
    )
