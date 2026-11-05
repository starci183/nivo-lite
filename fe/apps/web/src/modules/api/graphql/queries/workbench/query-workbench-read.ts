import { gql, type ApolloClient, type TypedDocumentNode } from "@apollo/client"
import type { ReadVariables } from "@nivo-lite/agent-sdk/block"
import { createAuthApolloClient } from "../../clients"
import type { GraphQLOperationContext } from "../../types"

/** What the generic read operation answers: the data of the named read, as JSON text. */
interface WorkbenchReadData {
    readonly workbenchRead: { readonly data: string }
}

/** The variables of the generic read operation: the read name and the literal variables of the binding, as JSON text. */
interface WorkbenchReadVariables {
    readonly name: string
    readonly variables: string
}

/**
 * The one generic read operation of the back end door: it runs any read of the module declarations by its name, under the viewer
 * rights. The document is hand-written and lives outside `queries/` on purpose: the codegen of the typed documents reads that
 * folder against the schema snapshot and would refuse an operation the snapshot does not hold yet.
 */
const query1: TypedDocumentNode<WorkbenchReadData, WorkbenchReadVariables> = gql`
    query WorkbenchRead($name: String!, $variables: String!) {
        workbenchRead(name: $name, variables: $variables) {
            data
        }
    }
`

/** Parameters of {@link queryWorkbenchRead}. */
interface QueryWorkbenchReadParams extends GraphQLOperationContext {
    /** The read to run, by name. */
    readonly name: string
    /** The literal variables the read runs with. */
    readonly variables: ReadVariables
}

/** Runs one named read through the generic door and answers its data as the back end sent it. */
export const queryWorkbenchRead = async ({
    name,
    variables,
    signal,
}: QueryWorkbenchReadParams): Promise<ApolloClient.QueryResult<WorkbenchReadData>> => {
    const apollo = createAuthApolloClient({ signal })
    return apollo.query({ query: query1, variables: { name, variables: JSON.stringify(variables) } })
}
