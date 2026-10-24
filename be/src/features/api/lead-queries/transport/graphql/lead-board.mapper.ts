import type { LeadBoardItem } from "@modules/domain/lead-views"
import type { LeadBoardRequest } from "../../application/lead-board.contracts"
import type { Connection } from "@modules/platform/pagination"
import type { LeadBoardInput } from "./dto/lead-board.input"
import type { LeadBoardConnectionType } from "./dto/lead-board-connection.type"
import { toLeadRecordType } from "./lead-record.mapper"

/** Maps the selected workspace to the board query request. */
export const toLeadBoardRequest = (workspaceId: string, input: LeadBoardInput): LeadBoardRequest => ({
    workspaceId,
    first: input.first,
    after: input.after,
})

/** Maps the owner's board records to GraphQL fields. */
export const toLeadBoardType = (result: Connection<LeadBoardItem>): LeadBoardConnectionType => ({
    nodes: result.nodes.map((lead) => ({
        ...toLeadRecordType(lead),
        ownerName: lead.ownerName,
        nextAction: lead.nextAction,
    })),
    pageInfo: result.pageInfo,
})
