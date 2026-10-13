import { Injectable } from "@nestjs/common"
import { ResponsibilityJournalService } from "@modules/domain/responsibilities"
import { WorkspaceMembersService } from "@modules/domain/workspace-members"
import type { LeadBoardItem } from "./lead-board.contracts"
import { LeadReadService } from "@modules/domain/leads"

@Injectable()
/** The authorized lead board, including each customer's oldest open follow-up. */
export class LeadBoardService {
    constructor(
        private readonly members: WorkspaceMembersService,
        private readonly leads: LeadReadService,
        private readonly responsibilities: ResponsibilityJournalService,
    ) {}

    /** Reads recent leads only after proving workspace membership. */
    async read(principalId: string, workspaceId: string): Promise<Array<LeadBoardItem>> {
        await this.members.require(principalId, workspaceId)
        const [leads, responsibilities] = await Promise.all([
            this.leads.list(workspaceId),
            this.responsibilities.listForBoard(workspaceId),
        ])
        return leads.map((lead) => {
            const step = responsibilities.find((candidate) => candidate.lead_id === lead.id)
            return { ...lead, ownerName: step?.owner_name ?? null, nextAction: step?.next_action ?? null }
        })
    }
}
