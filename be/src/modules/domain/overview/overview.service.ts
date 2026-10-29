import { Injectable } from "@nestjs/common"
import { WorkspaceMembersService } from "@modules/domain/workspace-members"
import { InjectClock } from "@modules/platform/clock"
import type { Clock } from "@modules/platform/clock"
import type { OverviewSnapshot } from "./overview.contracts"
import { presentGovernance } from "./governance.policy"
import { RECENT_EVENTS, windowAt } from "./overview.policy"
import { OverviewFiguresService } from "./overview-figures.service"
import { OverviewReadsService } from "./overview-reads.service"

@Injectable()
/** The read-only figures of the executive dashboard, read for a member of the workspace. */
export class OverviewService {
    constructor(
        @InjectClock() private readonly clock: Clock,
        private readonly members: WorkspaceMembersService,
        private readonly reads: OverviewReadsService,
        private readonly figures: OverviewFiguresService,
    ) {}

    /** Everything the dashboard shows, read in parallel for an active member of the workspace. */
    async dashboard(userId: string, workspaceId: string): Promise<OverviewSnapshot> {
        await this.members.require(userId, workspaceId)
        const window = windowAt(this.clock.now())
        const [responsibilities, agents, events, leads, pending, promo, governance, exceptions] = await Promise.all([
            this.reads.responsibilities(workspaceId),
            this.reads.agents(workspaceId),
            this.reads.events(workspaceId, RECENT_EVENTS),
            this.reads.leads(workspaceId),
            this.reads.pending(workspaceId),
            this.figures.promo(workspaceId, window),
            this.figures.governance(workspaceId, window.since7),
            this.reads.exceptions(workspaceId),
        ])
        return {
            since7: window.since7,
            responsibilities,
            agents,
            events,
            leads,
            pending,
            promo,
            governance: presentGovernance(governance),
            exceptions,
        }
    }
}
