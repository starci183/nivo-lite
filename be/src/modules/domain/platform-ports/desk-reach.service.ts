import { Injectable, Optional } from "@nestjs/common"
import { AgentAccountsService } from "@modules/domain/tools"
import { WorkspaceMemberSeatsService } from "@modules/domain/workspace-members"
import { reachOf } from "./agent-desk.mapper"
import type { AgentReachView, DeskAsker, DeskRightsRollup } from "./agent-desk.contracts"
import { InjectDeskRightsRollup } from "./platform-ports.decorators"

/** What an asker with no active seat reaches: nothing. */
const NOTHING: AgentReachView = { accounts: [], auto: [], ask: [], none: [] }

@Injectable()
/**
 * What an agent may touch: the node-rights roll-up of the agent (`NodeRightRollupsService.agentRights`, bound by the app; read as the
 * seat that asks, which proves its membership again) grouped by mode, with the accounts it is attached to and where each stands on the rights board.
 * No second derivation of a right: the roll-up decides what a running step holds.
 */
export class DeskReachService {
    constructor(
        private readonly accounts: AgentAccountsService,
        private readonly seats: WorkspaceMemberSeatsService,
        @Optional() @InjectDeskRightsRollup() private readonly rollups?: DeskRightsRollup,
    ) {}

    /** The accounts of the agent and its operations by mode; nothing for an asker with no active seat. */
    async reach(asker: DeskAsker, agentId: string): Promise<AgentReachView> {
        if (asker.memberId === null || this.rollups === undefined) return NOTHING
        const seat = await this.seats.seatById(asker.workspaceId, asker.memberId)
        if (seat?.status !== "active") return NOTHING
        const [rights, board] = await Promise.all([
            this.rollups.agentRights({ principalId: seat.userId, workspaceId: asker.workspaceId }, agentId),
            this.accounts.board(asker.workspaceId),
        ])
        return reachOf(rights, board, asker.locale)
    }
}
