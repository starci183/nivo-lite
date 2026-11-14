import { gql, type ApolloClient, type TypedDocumentNode } from "@apollo/client"
import type { ReadVariables } from "@nivo-lite/agent-sdk/block"
import { createAuthApolloClient, type GraphQLOperationContext } from "@nivo-lite/api"
import { webApiTransport } from "@/modules/api-transport"
import type { WorkbenchReadQuery, WorkbenchReadQueryVariables } from "../__generated__/graphql"

/**
 * The one generic read operation of the back end door: it runs any read of the module declarations by its name, under the viewer
 * rights. A read is not installation-scoped (it sees the workspace, filtered by the viewer's rights), so it carries no installation.
 */
const query1: TypedDocumentNode<WorkbenchReadQuery, WorkbenchReadQueryVariables> = gql`
    query WorkbenchRead($input: WorkbenchReadInput!) {
        workbenchRead(input: $input) {
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
}: QueryWorkbenchReadParams): Promise<ApolloClient.QueryResult<WorkbenchReadQuery>> => {
    const apollo = createAuthApolloClient(webApiTransport, { signal })
    return apollo.query({ query: query1, variables: { input: { name, vars: JSON.stringify(variables) } } })
}
