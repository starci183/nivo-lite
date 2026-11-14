import { gql, type ApolloClient, type TypedDocumentNode } from "@apollo/client"
import { createAuthApolloClient, type InputVariables, type QueryParams, type WireInput } from "@nivo-lite/api"
import { webApiTransport } from "@/modules/api-transport"
import type { ConnectionFieldsQuery, ConnectionFieldsQueryVariables } from "../__generated__/graphql"

/** Generated input of the connectionFields query. */
type QueryConnectionFieldsRequest = WireInput<ConnectionFieldsQueryVariables["input"]>

/** Generated response of the connectionFields query. */
type QueryConnectionFieldsResponse = ConnectionFieldsQuery

type Document = TypedDocumentNode<QueryConnectionFieldsResponse, InputVariables<QueryConnectionFieldsRequest>>

const query1: Document = gql`
    query ConnectionFields($input: GetConnectionFieldsInput!) {
        connectionFields(input: $input) {
            connectionId
            provider
            displayName
            canEdit
            writable
            canTest
            guidance {
                key
                text {
                    vi
                    en
                }
            }
            fields {
                key
                kind
                label {
                    vi
                    en
                }
                required
                minLength
                maxLength
                choiceSource
                searchable
                copyable
                guidance {
                    key
                    text {
                        vi
                        en
                    }
                }
                choices {
                    value
                    label {
                        vi
                        en
                    }
                    confirm {
                        key
                        text {
                            vi
                            en
                        }
                    }
                }
                value
                sealed
                editable
            }
            actions {
                key
                label {
                    vi
                    en
                }
                canRun
                guidance {
                    key
                    text {
                        vi
                        en
                    }
                }
                confirm {
                    key
                    text {
                        vi
                        en
                    }
                }
                inputs {
                    key
                    kind
                    label {
                        vi
                        en
                    }
                    required
                    minLength
                    maxLength
                    choiceSource
                    searchable
                    copyable
                    guidance {
                        key
                        text {
                            vi
                            en
                        }
                    }
                    choices {
                        value
                        label {
                            vi
                            en
                        }
                        confirm {
                            key
                            text {
                                vi
                                en
                            }
                        }
                    }
                    value
                    sealed
                    editable
                }
                results {
                    key
                    label {
                        vi
                        en
                    }
                }
            }
        }
    }
`

enum QueryConnectionFieldsDocument {
    Query1 = "query1",
}

const queryMap: Record<QueryConnectionFieldsDocument, Document> = {
    [QueryConnectionFieldsDocument.Query1]: query1,
}

type QueryConnectionFieldsParams = QueryParams<QueryConnectionFieldsDocument, QueryConnectionFieldsRequest> & {
    request: QueryConnectionFieldsRequest
}

/**
 * The form of one connected account: its display name and the fields its provider declares (a secret is never answered, only
 * whether one is sealed), and what the viewer may do with it. Rejects with the back end failure.
 */
export const queryConnectionFields = async ({
    query = QueryConnectionFieldsDocument.Query1,
    request,
    signal,
}: QueryConnectionFieldsParams): Promise<ApolloClient.QueryResult<QueryConnectionFieldsResponse>> => {
    const apollo = createAuthApolloClient(webApiTransport, { signal })
    return apollo.query({ query: queryMap[query], variables: { input: request }, fetchPolicy: "no-cache" })
}
