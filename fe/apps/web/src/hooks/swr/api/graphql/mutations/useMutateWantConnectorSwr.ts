import { useGraphQLMutationSwr } from "@/hooks/reuseables"
import { mutateWantConnector } from "@/modules/api/graphql/mutations/mutation-want-connector"

/** The SWR key of the wantConnector mutation. */
export const MUTATE_WANT_CONNECTOR_SWR_KEY = "MUTATE_WANT_CONNECTOR_SWR"

/** SWR mutation for {@link mutateWantConnector}: `trigger(input)` answers the payload and rejects with the back end failure. */
export const useMutateWantConnectorSwr = () =>
    useGraphQLMutationSwr(MUTATE_WANT_CONNECTOR_SWR_KEY, mutateWantConnector, (data) => data.wantConnector)
