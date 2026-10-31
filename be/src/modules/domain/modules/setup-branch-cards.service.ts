import { Injectable, Optional } from "@nestjs/common"
import type { BranchCardPayload, CardRecord, ProposedCardRecord } from "@modules/domain/module-setup-writes"
import { ModulesError, ModulesErrorCode } from "./errors/modules.error"
import { InjectSetupGraph } from "./modules.decorators"
import type { SetupGraphPort } from "./modules.port"
import type { CardDecision } from "./module-setup.contracts"
import { SetupGraphService } from "./setup-graph.service"
import { cardOf, targetKeyOf } from "./policies/setup-writes.policy"
import type { ProposedBranch } from "./policies/setup-writes.policy"

/** Closes a decided branch card with its resulting payload. */
type BranchCloser = (status: "applied" | "rejected", payload: BranchCardPayload, result: { readonly outcome: string }) => Promise<CardRecord>

/** What confirming a branch card takes. */
export interface ConfirmBranch {
    /** The workspace. */
    readonly workspaceId: string
    /** The installation the setup is for. */
    readonly installationId: string
    /** The chat message the card came from, or null. */
    readonly messageId: string | null
    /** The card as proposed. */
    readonly base: BranchCardPayload
    /** The edits of the owner. */
    readonly change: CardDecision
    /** Closes the card. */
    readonly close: BranchCloser
}

@Injectable()
/**
 * The branch cards of the setup chat: the person the owner named is looked up among the seats of the workspace when the card is proposed,
 * and a confirmed card is written into the draft of the action graph with the words of the owner as its source. The owner can still
 * correct the band of the boundary and the person on the card; a card missing either cannot be confirmed.
 */
export class SetupBranchCardsService {
    constructor(
        private readonly seats: SetupGraphService,
        @Optional() @InjectSetupGraph() private readonly graph: SetupGraphPort | null = null,
    ) {}

    /** The card to store for a proposed branch: the seat of the named person filled in when it is found. */
    async cardOf(workspaceId: string, write: ProposedBranch): Promise<ProposedCardRecord> {
        const approverMemberId = await this.seats.seatNamed(workspaceId, write.payload.approverName)
        return cardOf(write, { ...write.payload, approverMemberId })
    }

    /** The key two cards share when they are about the same action. */
    targetOf(write: ProposedBranch): string {
        return targetKeyOf(write)
    }

    /** Writes the confirmed branch into the draft of the graph and closes the card. */
    async confirm(input: ConfirmBranch): Promise<CardRecord> {
        const belongsTo = input.change.belongsTo ?? input.base.belongsTo
        const approverMemberId = input.change.approverMemberId ?? input.base.approverMemberId
        if (belongsTo === null || approverMemberId === null || this.graph === null) {
            throw new ModulesError({ code: ModulesErrorCode.CardBranchIncomplete })
        }
        await this.graph.applyBranch({
            workspaceId: input.workspaceId,
            installationId: input.installationId,
            action: input.base.action,
            boundaryVnd: input.base.boundaryVnd,
            belongsTo,
            approverMemberId,
            quote: input.base.quote,
            messageId: input.messageId,
        })
        return input.close("applied", { ...input.base, belongsTo, approverMemberId }, { outcome: "applied" })
    }
}
