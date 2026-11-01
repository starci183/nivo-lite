import { Injectable } from "@nestjs/common"
import { BrainFactsService } from "@modules/domain/brain-facts"
import { DecisionsService } from "@modules/domain/decisions"
import { StaffService } from "@modules/domain/staff"
import { WorkspaceMembersService } from "@modules/domain/workspace-members"
import { InjectClock } from "@modules/platform/clock"
import type { Clock } from "@modules/platform/clock"
import { AccountingBookService } from "./accounting-book.service"
import { InjectAccountingGateway } from "./accounting-gateway.decorators"
import type { AccountingGateway } from "./accounting-gateway.port"
import type { AccountingBookView } from "./accounting-book-view.contracts"
import { toAccountingBookView } from "./accounting-book-view.mapper"
import type { AccountingWorkbenchView } from "./accounting-workbench-view.contracts"
import { toAccountingWorkbenchView } from "./accounting-workbench-view.mapper"
import type { AccountingLedgerEntry } from "@modules/domain/ledger"
import { buildAccountingWorkbench } from "./accounting-workbench.policy"
import { vnDayOf } from "./desk-daily.service"
import { taxProfileOf } from "./tax-profile.policy"

@Injectable()
/** The member-scoped accounting read side over live records, naming the connector that feeds the payment credits. */
export class AccountingService {
    constructor(
        private readonly books: AccountingBookService,
        private readonly members: WorkspaceMembersService,
        private readonly decisions: DecisionsService,
        private readonly staff: StaffService,
        private readonly facts: BrainFactsService,
        @InjectAccountingGateway() private readonly gateway: AccountingGateway,
        @InjectClock() private readonly clock: Clock,
    ) {}
    /** Every raw accounting record needed for client-side evidence inspection. */
    async book(principalId: string, workspaceId: string): Promise<AccountingBookView> {
        await this.members.require(principalId, workspaceId)
        return toAccountingBookView(await this.books.read(workspaceId))
    }
    /** The period figures, evidence, waiting questions, staff, corrections and ledger for any active member. */
    async workbench(principalId: string, workspaceId: string): Promise<AccountingWorkbenchView> {
        const member = await this.members.require(principalId, workspaceId)
        const [book, exceptions, staff, creditsSource, payablesSource, facts] = await Promise.all([
            this.books.read(workspaceId),
            this.decisions.listAccountingWaiting(principalId, workspaceId),
            this.staff.list(workspaceId),
            this.gateway.creditsSource(workspaceId),
            this.gateway.payablesSource(workspaceId),
            this.facts.list(workspaceId, { statuses: ["active"] }),
        ])
        const now = this.clock.now()
        return toAccountingWorkbenchView(
            buildAccountingWorkbench({
                book,
                now,
                exceptions,
                staff,
                ownerName: member.displayName,
                role: member.role,
                creditsSource,
                payablesSource,
                profile: taxProfileOf(facts),
                today: vnDayOf(now),
            }),
        )
    }

    /** Reads the ledger derived from the same test-filtered records as the accounting workbench. */
    async ledger(principalId: string, workspaceId: string): Promise<ReadonlyArray<AccountingLedgerEntry>> {
        return (await this.workbench(principalId, workspaceId)).ledger
    }
}
