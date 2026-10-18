import { gql } from "@apollo/client"
import type { TypedDocumentNode } from "@apollo/client"
import { createAuthApolloClient } from "../clients"
import type { InputVariables, QueryParams, WireInput } from "../types"
import type { VideoProjectsQuery, VideoProjectsQueryVariables } from "../__generated__/graphql"

/** The input of the `videoProjects` query. */
type QueryVideoProjectsRequest = WireInput<VideoProjectsQueryVariables["input"]>

/** The generated payload of the `videoProjects` query. */
type QueryVideoProjectsResponse = VideoProjectsQuery

type Document = TypedDocumentNode<QueryVideoProjectsResponse, InputVariables<QueryVideoProjectsRequest>>

const query1: Document = gql`
    query VideoProjects($input: ListVideoProjectsInput!) {
        videoProjects(input: $input) {
            approvedAt
            approvedByName
            aspect
            createdAt
            goal
            id
            inputs {
                auto
                media
                notes
                sourceIds
            }
            lastErrorCode
            publishedAt
            render {
                captionsUrl
                captionsLang
                downloadUrl
                durationMs
                errorCode
                id
                posterUrl
                progress
                sizeBytes
                stage
                status
                videoUrl
            }
            renderCount
            script {
                caption
                id
                media
                role
                visual
                voiceover
            }
            scriptMs
            status
            targetSeconds
            title
            updatedAt
            version
        }
    }
`

enum QueryVideoProjects {
    Query1 = "query1",
}

const queryMap: Record<QueryVideoProjects, Document> = {
    [QueryVideoProjects.Query1]: query1,
}

/** Apollo options for the `videoProjects` query. */
type QueryVideoProjectsParams = QueryParams<QueryVideoProjects, QueryVideoProjectsRequest> & {
    request: QueryVideoProjectsRequest
}

/** Reads `videoProjects` through the authenticated back end GraphQL API. */
export const queryVideoProjects = async ({
    query = QueryVideoProjects.Query1,
    request,
    signal,
}: QueryVideoProjectsParams) => {
    const apollo = createAuthApolloClient({ signal })
    return apollo.query({
        query: queryMap[query],
        fetchPolicy: "no-cache",
        variables: { input: request },
    })
}
