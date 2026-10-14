import { gql } from "@apollo/client"
import type { TypedDocumentNode } from "@apollo/client"
import { createAuthApolloClient } from "../clients"
import type { QueryParams } from "../types"
import type { ModulesCatalogQuery } from "../__generated__/graphql"

const query1: TypedDocumentNode<ModulesCatalogQuery> = gql`
    query ModulesCatalog {
        modulesCatalog {
            categories {
                key
                label {
                    vi
                    en
                }
            }
            modules {
                key
                name {
                    vi
                    en
                }
                shortName {
                    vi
                    en
                }
                description {
                    vi
                    en
                }
                points {
                    vi
                    en
                }
                gates {
                    key
                    label_vi
                    label_en
                    hint_vi
                    hint_en
                    writes {
                        kind
                        subjectType
                        attributeLabel
                        scope
                        action
                        field
                    }
                }
                authorityActions {
                    action
                    label {
                        vi
                        en
                    }
                    note
                }
            }
        }
    }
`

enum QueryModulesCatalog {
    Query1 = "query1",
}

const queryMap: Record<QueryModulesCatalog, TypedDocumentNode<ModulesCatalogQuery>> = {
    [QueryModulesCatalog.Query1]: query1,
}

/** Reads backend-owned catalogue copy in both product languages. */
export const queryModulesCatalog = async ({
    query = QueryModulesCatalog.Query1,
    signal,
}: QueryParams<QueryModulesCatalog> = {}) => {
    const apollo = createAuthApolloClient({ signal })
    return apollo.query({ query: queryMap[query] })
}
