import { gql } from "@apollo/client"
import type { TypedDocumentNode } from "@apollo/client"
import { createAuthApolloClient } from "../clients"
import type { InputVariables, QueryParams, WireInput } from "../types"
import type { VideoProjectQuery, VideoProjectQueryVariables } from "../__generated__/graphql"

/** The input of the `videoProject` query. */
type QueryVideoProjectRequest = WireInput<VideoProjectQueryVariables["input"]>

/** The generated payload of the `videoProject` query. */
type QueryVideoProjectResponse = VideoProjectQuery

type Document = TypedDocumentNode<QueryVideoProjectResponse, InputVariables<QueryVideoProjectRequest>>

const query1: Document = gql`
    query VideoProject($input: GetVideoProjectInput!) {
        videoProject(input: $input) {
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

enum QueryVideoProject {
    Query1 = "query1",
}

const queryMap: Record<QueryVideoProject, Document> = {
    [QueryVideoProject.Query1]: query1,
}

/** Apollo options for the `videoProject` query. */
type QueryVideoProjectParams = QueryParams<QueryVideoProject, QueryVideoProjectRequest> & {
    request: QueryVideoProjectRequest
}

/** Reads `videoProject` through the authenticated back end GraphQL API. */
export const queryVideoProject = async ({
    query = QueryVideoProject.Query1,
    request,
    signal,
}: QueryVideoProjectParams) => {
    const apollo = createAuthApolloClient({ signal })
    return apollo.query({
        query: queryMap[query],
        fetchPolicy: "no-cache",
        variables: { input: request },
    })
}
