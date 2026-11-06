import { gql, type ApolloClient, type TypedDocumentNode } from "@apollo/client"
import type { JsonValue } from "@nivo-lite/agent-sdk/schema"
import { createAuthApolloClient } from "../clients"
import type { GraphQLOperationContext } from "../types"

/** What the generic action operation answers: the `ActionResult` of the named action, as JSON text. */
interface WorkbenchActionData {
    readonly workbenchAction: { readonly data: string }
}

/** The variables of the generic action operation: the `WorkbenchActionInput` of the door, the action name and its flat input as JSON text. */
interface WorkbenchActionVariables {
    readonly input: { readonly name: string; readonly input: string }
}

/**
 * The one generic action operation of the back end door: it runs any action of the module declarations by its name, under the
 * viewer rights. Hand-written and typed here, like `query-workbench-read.ts`; the schema snapshot holds `workbenchAction`.
 */
const mutation1: TypedDocumentNode<WorkbenchActionData, WorkbenchActionVariables> = gql`
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
}

/** Runs one named action through the generic door and answers its result as the back end sent it. */
export const mutateWorkbenchAction = async ({
    name,
    input,
    signal,
}: MutateWorkbenchActionParams): Promise<ApolloClient.MutateResult<WorkbenchActionData>> => {
    const apollo = createAuthApolloClient({ signal })
    return apollo.mutate({ mutation: mutation1, variables: { input: { name, input: JSON.stringify(input) } } })
}
