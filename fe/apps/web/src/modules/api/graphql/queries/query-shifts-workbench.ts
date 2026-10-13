import { gql } from "@apollo/client"
import type { TypedDocumentNode } from "@apollo/client"
import { createAuthApolloClient } from "../clients"
import type { QueryParams } from "../types"
import type { Query, QueryShiftsWorkbenchArgs } from "../__generated__/schema"

/** The arguments of the `shiftsWorkbench` query. */
export type QueryShiftsWorkbenchRequest = QueryShiftsWorkbenchArgs

/** The response of the `shiftsWorkbench` query. */
type QueryShiftsWorkbenchResponse = Pick<Query, "shiftsWorkbench">

const query1: TypedDocumentNode<QueryShiftsWorkbenchResponse, QueryShiftsWorkbenchRequest> = gql`
    query ShiftsWorkbench($week: String) {
        shiftsWorkbench(week: $week) {
            allAvailability {
                available
                createdAt
                date
                end
                id
                note
                staffId
                start
                status
                weekday
            }
            figures {
                hoursMonth
                leavePending
                openGaps
                weekFilled
                weekHasSchedule
                weekTotal
            }
            myProfileId
            reminderOn
            requests {
                availability {
                    available
                    createdAt
                    date
                    end
                    id
                    note
                    staffId
                    start
                    status
                    weekday
                }
                leaves {
                    createdAt
                    from
                    id
                    item {
                        decidedPath
                        id
                        resultSummary
                        status
                        summary
                    }
                    reason
                    staffId
                    status
                    to
                    workItemId
                }
                swaps {
                    checks
                    createdAt
                    fromStaffId
                    id
                    item {
                        decidedPath
                        id
                        resultSummary
                        status
                        summary
                    }
                    kind
                    reason
                    shiftId
                    shiftLine
                    status
                    toStaffId
                    workItemId
                }
            }
            role
            setup {
                blocks {
                    end
                    id
                    ideal
                    min
                    peak
                    positionId
                    start
                    weekday
                }
                positions {
                    color
                    id
                    name
                }
                settings {
                    leaveNoticeDays
                    noshowMinutes
                    openingHours {
                        close
                        open
                        weekday
                    }
                    overtimeHoursWeek
                    remindMinutes
                    swapNoticeHours
                }
                staff {
                    active
                    id
                    maxDay
                    maxWeek
                    minRest
                    name
                    phone
                    positionIds
                    skills
                    staffRowId
                    telegramChatId
                    wage
                    zaloUserId
                }
            }
            staffRows {
                id
                name
            }
            today
            week {
                approvedAvail {
                    available
                    date
                    end
                    staffId
                    start
                    weekday
                }
                approvedLeaves {
                    from
                    staffId
                    to
                }
                checkins {
                    checkedInAt
                    shiftId
                }
                current {
                    costVnd
                    createdAt
                    evidence
                    explanation
                    id
                    publishedAt
                    solverMs
                    source
                    status
                    summary
                    version
                    weekStart
                    workItemId
                }
                monday
                prior {
                    segs {
                        date
                        e
                        pos
                        s
                    }
                    staffId
                }
                publishItem {
                    decidedPath
                    id
                    resultSummary
                    status
                    summary
                }
                shifts {
                    date
                    end
                    id
                    positionId
                    staffId
                    start
                    status
                }
                versions {
                    costVnd
                    createdAt
                    id
                    publishedAt
                    status
                    version
                }
            }
        }
    }
`

enum QueryShiftsWorkbench {
    Query1 = "query1",
}

const queryMap: Record<QueryShiftsWorkbench, TypedDocumentNode<QueryShiftsWorkbenchResponse, QueryShiftsWorkbenchRequest>> = {
    [QueryShiftsWorkbench.Query1]: query1,
}

/** Apollo params for {@link queryShiftsWorkbench}. */
type QueryShiftsWorkbenchParams = QueryParams<QueryShiftsWorkbench, QueryShiftsWorkbenchRequest> & { request: QueryShiftsWorkbenchRequest }

/** Runs the `shiftsWorkbench` query. */
export const queryShiftsWorkbench = async ({ query = QueryShiftsWorkbench.Query1, request, signal }: QueryShiftsWorkbenchParams) => {
    const apollo = createAuthApolloClient({ signal })
    return apollo.query({ query: queryMap[query], variables: request })
}
