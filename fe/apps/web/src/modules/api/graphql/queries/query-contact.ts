import { gql, type ApolloClient, type TypedDocumentNode } from "@apollo/client"
import { createAuthApolloClient, type InputVariables, type QueryParams, type WireInput } from "@nivo-lite/api"
import { webApiTransport } from "@/modules/api-transport"
import type { ContactQuery, ContactQueryVariables } from "../__generated__/graphql"

/** The response of the `contact` query: the typed payload straight from the back end contract. */
type QueryContactResponse = ContactQuery

/** The input of the `contact` query. */
type QueryContactRequest = WireInput<ContactQueryVariables["input"]>

type Document = TypedDocumentNode<QueryContactResponse, InputVariables<QueryContactRequest>>

const query1: Document = gql`
    query Contact($input: ContactInput!) {
        contact(input: $input) {
            contact {
                id
                displayName
                tags
                createdAt
                updatedAt
                identities {
                    id
                    kind
                    provider
                    account
                    value
                    verified
                    verifiedBy
                    source
                    joinedBy
                    at
                }
            }
            memory {
                facts {
                    name
                    value
                }
                notes {
                    workflow
                    step
                    status
                    at
                    output
                }
            }
            suggestions {
                contactId
                displayName
                why
                identityKind
                identityValue
            }
        }
    }
`

enum QueryContact {
    Query1 = "query1",
}

const queryMap: Record<QueryContact, Document> = { [QueryContact.Query1]: query1 }

/** Apollo params for {@link queryContact}. */
interface QueryContactParams extends QueryParams<QueryContact, QueryContactRequest> {
    request: QueryContactRequest
}

/**
 * Reads one person of the workspace with their identities, agent memory and the people they may be (the back end
 * `contact` query). The answer is null for a person who is not in the workspace (or was merged away).
 */
export const queryContact = async ({
    query = QueryContact.Query1,
    request,
    signal,
}: QueryContactParams): Promise<ApolloClient.QueryResult<QueryContactResponse>> => {
    const apollo = createAuthApolloClient(webApiTransport, { signal })
    return apollo.query({ query: queryMap[query], variables: { input: request }, fetchPolicy: "no-cache" })
}
