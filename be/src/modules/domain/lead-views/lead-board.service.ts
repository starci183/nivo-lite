import { Injectable } from "@nestjs/common"
import { ResponsibilityJournalService } from "@modules/domain/responsibilities"
import { WorkspaceMembersService } from "@modules/domain/workspace-members"
import type { LeadBoardItem } from "./lead-board.contracts"
import { LeadReadService } from "@modules/domain/leads"
import type { Connection, PageRequest } from "@modules/platform/pagination"

@Injectable()
/** The authorized lead board, including each customer's oldest open follow-up. */
export class LeadBoardService {
    constructor(
        private readonly members: WorkspaceMembersService,
        private readonly leads: LeadReadService,
        private readonly responsibilities: ResponsibilityJournalService,
    ) {}

    /** Reads recent leads only after proving workspace membership. */
    async read(principalId: string, workspaceId: string, request: PageRequest): Promise<Connection<LeadBoardItem>> {
        await this.members.require(principalId, workspaceId)
        const leads = await this.leads.listPage(workspaceId, request)
        const responsibilities = await this.responsibilities.listForBoard(
            workspaceId,
            leads.nodes.map((lead) => lead.id),
        )
        return {
            nodes: leads.nodes.map((lead) => {
                const step = responsibilities.find((candidate) => candidate.lead_id === lead.id)
                return { ...lead, ownerName: step?.owner_name ?? null, nextAction: step?.next_action ?? null }
            }),
            pageInfo: leads.pageInfo,
        }
    }
}
