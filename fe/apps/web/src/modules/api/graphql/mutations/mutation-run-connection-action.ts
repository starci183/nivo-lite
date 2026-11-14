import { gql, type ApolloClient, type TypedDocumentNode } from "@apollo/client"
import { createAuthApolloClient, type InputVariables, type MutateParams, type WireInput } from "@nivo-lite/api"
import { webApiTransport } from "@/modules/api-transport"
import type { RunConnectionActionMutation, RunConnectionActionMutationVariables } from "../__generated__/graphql"

/** The input of the `runConnectionAction` mutation. */
export type MutateRunConnectionActionRequest = WireInput<RunConnectionActionMutationVariables["input"]>

/** The response of the `runConnectionAction` mutation. */
type MutateRunConnectionActionResponse = RunConnectionActionMutation

type Document = TypedDocumentNode<MutateRunConnectionActionResponse, InputVariables<MutateRunConnectionActionRequest>>

const mutation1: Document = gql`
    mutation RunConnectionAction($input: RunConnectionActionInput!) {
        runConnectionAction(input: $input) {
            action
            results {
                key
                label {
                    vi
                    en
                }
                value
            }
            form {
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
    }
`

enum MutateRunConnectionActionDocument {
    Mutation1 = "mutation1",
}

const mutationMap: Record<MutateRunConnectionActionDocument, Document> = {
    [MutateRunConnectionActionDocument.Mutation1]: mutation1,
}

type MutateRunConnectionActionParams = MutateParams<MutateRunConnectionActionDocument, MutateRunConnectionActionRequest>

/** Runs one action the account's form declares (a test send, making a sender the default) and answers its results and the form again. Rejects with the back end failure. */
export const mutateRunConnectionAction = async ({
    mutation = MutateRunConnectionActionDocument.Mutation1,
    request,
    signal,
}: MutateRunConnectionActionParams): Promise<ApolloClient.MutateResult<MutateRunConnectionActionResponse>> => {
    const apollo = createAuthApolloClient(webApiTransport, { signal })
    return apollo.mutate({ mutation: mutationMap[mutation], variables: { input: request } })
}
