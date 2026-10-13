import type { LeadBoardItem } from "@modules/domain/lead-views"
import type { LeadBoardRequest } from "../../application/lead-board.contracts"
import type { LeadBoardType } from "./dto/lead-board.type"
import { toLeadRecordType } from "./lead-record.mapper"

/** Maps the selected workspace to the board query request. */
export const toLeadBoardRequest = (workspaceId: string): LeadBoardRequest => ({ workspaceId })

/** Maps the owner's board records to GraphQL fields. */
export const toLeadBoardType = (result: ReadonlyArray<LeadBoardItem>): Array<LeadBoardType> =>
    result.map((lead) => ({ ...toLeadRecordType(lead), ownerName: lead.ownerName, nextAction: lead.nextAction }))
