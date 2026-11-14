import { gql, type ApolloClient, type TypedDocumentNode } from "@apollo/client"
import type { JsonValue } from "@nivo-lite/agent-sdk/schema"
import { createAuthApolloClient, type GraphQLOperationContext } from "@nivo-lite/api"
import { webApiTransport } from "@/modules/api-transport"
import type { WorkbenchActionMutation, WorkbenchActionMutationVariables } from "../__generated__/graphql"

/**
 * The one generic action operation of the back end door: it runs any action of the module declarations by its name, under the
 * viewer rights.
 */
const mutation1: TypedDocumentNode<WorkbenchActionMutation, WorkbenchActionMutationVariables> = gql`
    mutation WorkbenchAction($input: WorkbenchActionInput!) {
        workbenchAction(input: $input) {
            data
        }
    }
`

/** Parameters of {@link mutateWorkbenchAction}. */
interface MutateWorkbenchActionParams extends GraphQLOperationContext {
    /** The action to run, by name. */
    readonly name: string
    /** The flat payload: the values of the form with the record id (and the row command) merged in. */
    readonly input: JsonValue
    /** The installation of the module the workbench is opened for (the agent the records are stamped for); absent, the module's oldest. */
    readonly installationId?: string | undefined
}

/** Runs one named action through the generic door and answers its result as the back end sent it. */
export const mutateWorkbenchAction = async ({
    name,
    input,
    installationId,
    signal,
}: MutateWorkbenchActionParams): Promise<ApolloClient.MutateResult<WorkbenchActionMutation>> => {
    const apollo = createAuthApolloClient(webApiTransport, { signal })
    return apollo.mutate({
        mutation: mutation1,
        variables: {
            input: {
                name,
                input: JSON.stringify(input),
                installationId: installationId ?? null,
            },
        },
    })
}
