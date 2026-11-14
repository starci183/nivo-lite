import { gql, type ApolloClient, type TypedDocumentNode } from "@apollo/client"
import { createAuthApolloClient, type InputVariables, type MutateParams, type WireInput } from "@nivo-lite/api"
import { webApiTransport } from "@/modules/api-transport"
import type { UpdateConnectionMutation, UpdateConnectionMutationVariables } from "../__generated__/graphql"

/** The input of the `updateConnection` mutation. */
export type MutateUpdateConnectionRequest = WireInput<UpdateConnectionMutationVariables["input"]>

/** The response of the `updateConnection` mutation. */
type MutateUpdateConnectionResponse = UpdateConnectionMutation

type Document = TypedDocumentNode<MutateUpdateConnectionResponse, InputVariables<MutateUpdateConnectionRequest>>

const mutation1: Document = gql`
    mutation UpdateConnection($input: UpdateConnectionInput!) {
        updateConnection(input: $input) {
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

enum MutateUpdateConnectionDocument {
    Mutation1 = "mutation1",
}

const mutationMap: Record<MutateUpdateConnectionDocument, Document> = {
    [MutateUpdateConnectionDocument.Mutation1]: mutation1,
}

type MutateUpdateConnectionParams = MutateParams<MutateUpdateConnectionDocument, MutateUpdateConnectionRequest>

/** Saves what changed in one account's form (its display name and the fields it names; a secret is sealed) and answers the form again. Rejects with the back end failure. */
export const mutateUpdateConnection = async ({
    mutation = MutateUpdateConnectionDocument.Mutation1,
    request,
    signal,
}: MutateUpdateConnectionParams): Promise<ApolloClient.MutateResult<MutateUpdateConnectionResponse>> => {
    const apollo = createAuthApolloClient(webApiTransport, { signal })
    return apollo.mutate({ mutation: mutationMap[mutation], variables: { input: request } })
}
