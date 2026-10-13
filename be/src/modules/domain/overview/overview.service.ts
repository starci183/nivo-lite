import { Injectable } from "@nestjs/common"
import type { EntityManager } from "typeorm"
import { WorkspaceMembersService } from "@modules/domain/workspace-members"
import { InjectClock } from "@modules/platform/clock"
import type { Clock } from "@modules/platform/clock"
import { InjectPrimaryEntityManager } from "@modules/platform/database"
import type {
    OverviewAgent,
    OverviewEvent,
    OverviewException,
    OverviewGovernance,
    OverviewLead,
    OverviewPending,
    OverviewPromo,
    OverviewResponsibility,
    OverviewSnapshot,
} from "./overview.contracts"
import { presentGovernance } from "./governance.policy"
import type { RawGovernance } from "./governance.policy"
import { RECENT_EVENTS, windowAt } from "./overview.policy"
import {
    DASHBOARD_AGENTS,
    DASHBOARD_EVENTS,
    DASHBOARD_EXCEPTIONS,
    DASHBOARD_GOVERNANCE,
    DASHBOARD_LEADS,
    DASHBOARD_PENDING,
    DASHBOARD_PROMO,
    DASHBOARD_RESPONSIBILITIES,
} from "./persistence/overview.sql"

/** A statement that answers one jsonb array in `rows`. */
interface RowsAnswer<Row> {
    readonly rows: Array<Row>
}

/** The rows of a one-array answer; an empty answer has none. */
const rowsOf = <Row>(answer: Array<RowsAnswer<Row>>): Array<Row> => answer[0]?.rows ?? []

@Injectable()
/** The read-only figures of the executive dashboard, read for a member of the workspace. */
export class OverviewService {
    constructor(
        @InjectPrimaryEntityManager() private readonly entityManager: EntityManager,
        @InjectClock() private readonly clock: Clock,
        private readonly members: WorkspaceMembersService,
    ) {}

    /** Everything the dashboard shows, read in parallel for an active member of the workspace. */
    async dashboard(userId: string, workspaceId: string): Promise<OverviewSnapshot> {
        await this.members.require(userId, workspaceId)
        const window = windowAt(this.clock.now())
        const [responsibilities, agents, events, leads, pending, promo, governance, exceptions] = await Promise.all([
            this.entityManager
                .query<Array<RowsAnswer<OverviewResponsibility>>>(DASHBOARD_RESPONSIBILITIES, [workspaceId])
                .then(rowsOf),
            this.entityManager.query<Array<RowsAnswer<OverviewAgent>>>(DASHBOARD_AGENTS, [workspaceId]).then(rowsOf),
            this.entityManager
                .query<Array<RowsAnswer<OverviewEvent>>>(DASHBOARD_EVENTS, [workspaceId, RECENT_EVENTS])
                .then(rowsOf),
            this.entityManager.query<Array<RowsAnswer<OverviewLead>>>(DASHBOARD_LEADS, [workspaceId]).then(rowsOf),
            this.entityManager.query<Array<RowsAnswer<OverviewPending>>>(DASHBOARD_PENDING, [workspaceId]).then(rowsOf),
            this.entityManager.query<Array<{ promo: OverviewPromo }>>(DASHBOARD_PROMO, [
                workspaceId,
                window.foundingFrom,
                window.foundingTo,
            ]),
            this.entityManager.query<Array<{ governance: RawGovernance }>>(DASHBOARD_GOVERNANCE, [
                workspaceId,
                window.since7,
            ]),
            this.entityManager
                .query<Array<RowsAnswer<OverviewException>>>(DASHBOARD_EXCEPTIONS, [workspaceId])
                .then(rowsOf),
        ])
        return {
            since7: window.since7,
            responsibilities,
            agents,
            events,
            leads,
            pending,
            promo: promo[0]?.promo ?? EMPTY_PROMO,
            governance: governance[0] === undefined ? EMPTY_GOVERNANCE : presentGovernance(governance[0].governance),
            exceptions,
        }
    }
}

const EMPTY_PROMO: OverviewPromo = {
    chatbot: null,
    isFoundingMember: false,
    websiteLeads: [],
    firstEvents: [],
    hasCustomerConversation: false,
    hasLeadConversation: false,
    approvedCount: 0,
    hasWon: false,
    invoiceApproved: false,
}

const EMPTY_GOVERNANCE: OverviewGovernance = {
    authority: null,
    leads: [],
    orders: [],
    invoices: [],
    transactions: [],
    work: [],
    pendingWithoutWork: 0,
    decisions7: [],
    recent: [],
}
