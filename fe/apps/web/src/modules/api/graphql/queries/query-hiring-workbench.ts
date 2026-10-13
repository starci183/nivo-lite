import { gql } from "@apollo/client"
import type { TypedDocumentNode } from "@apollo/client"
import { createAuthApolloClient } from "../clients"
import type { QueryParams } from "../types"
import type { Query } from "../__generated__/schema"

/** The response of the `hiringWorkbench` query. */
type QueryHiringWorkbenchResponse = Pick<Query, "hiringWorkbench">

const query1: TypedDocumentNode<QueryHiringWorkbenchResponse> = gql`
    query HiringWorkbench {
        hiringWorkbench {
            candidates {
                answers {
                    answer
                    question
                    questionId
                }
                availability
                conversationId
                createdAt
                cvMime
                cvName
                cvPath
                cvSize
                email
                id
                jobId
                name
                notes
                phone
                rejectedReason
                score
                scoreLabel
                scoreReasons {
                    criterion
                    note
                    status
                }
                scoreSummary
                screenedAt
                source
                staffId
                stage
                stageChangedAt
                workspaceId
            }
            figures {
                interviewsWeek
                offersSent
                offersWaiting
                openRoles
                pipeline
                totalRoles
            }
            interviews {
                candidateId
                createdAt
                durationMin
                id
                interviewerName
                interviewerUserId
                jobId
                location
                mode
                note
                proposedSlots {
                    end
                    start
                }
                reminderSentAt
                slotEnd
                slotStart
                status
                token
                workItemId
                workspaceId
            }
            jobs {
                adVariants
                channels
                closesAt
                createdAt
                description
                employmentType
                headcount
                id
                location
                payMaxVnd
                payMinVnd
                payUnit
                position
                publicUrl
                questions {
                    choices
                    expectChoices
                    expectNumber
                    expectYesNo
                    id
                    required
                    text
                    type
                }
                requirements {
                    availability
                    experienceNote
                    experienceYears
                    mustHave
                    niceToHave
                    skills
                }
                schedule
                slug
                status
                title
                updatedAt
                workspaceId
            }
            meUserId
            members {
                name
                role
                userId
                windows {
                    endMin
                    startMin
                    weekday
                }
            }
            nowIso
            offers {
                candidateId
                createdAt
                draft
                expiresAt
                id
                jobId
                respondedAt
                sentAt
                sentVia
                status
                terms {
                    note
                    pay
                    probation
                    startDate
                    title
                }
                token
                workItemId
                workspaceId
            }
            onboarding {
                candidateId
                done
                doneAt
                id
                sort
                title
            }
            origin
            settings {
                adTone
                applyConsentText
                autoCloseWhenFilled
                notifyNewCandidate
                publicSlug
                remindInterview
                retentionDays
                workspaceId
            }
            waitingApprovals
        }
    }
`

enum QueryHiringWorkbench {
    Query1 = "query1",
}

const queryMap: Record<QueryHiringWorkbench, TypedDocumentNode<QueryHiringWorkbenchResponse>> = {
    [QueryHiringWorkbench.Query1]: query1,
}

/** Apollo params for {@link queryHiringWorkbench}. */
type QueryHiringWorkbenchParams = QueryParams<QueryHiringWorkbench>

/** Runs the `hiringWorkbench` query. */
export const queryHiringWorkbench = async ({
    query = QueryHiringWorkbench.Query1,
    signal,
}: QueryHiringWorkbenchParams = {}) => {
    const apollo = createAuthApolloClient({ signal })
    return apollo.query({ query: queryMap[query] })
}
