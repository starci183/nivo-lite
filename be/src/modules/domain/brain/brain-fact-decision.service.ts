import { Injectable } from "@nestjs/common"
import type { FactRecord } from "@modules/domain/brain-facts"
import type { FactDecision } from "./brain.contracts"
import { BrainChangeMessagesService } from "./brain-change-messages.service"
import { BrainService } from "./brain.service"

@Injectable()
/** A decision taken on a fact (apply, reject, choose, split, retire) and the open `brain.change` card of its request kept in line. */
export class BrainFactDecisionService {
    constructor(
        private readonly brain: BrainService,
        private readonly changes: BrainChangeMessagesService,
    ) {}

    /** Decides the fact for the caller, then follows the open change card of that request (applied / rejected). */
    async decide(principalId: string, decision: FactDecision): Promise<FactRecord> {
        const fact = await this.brain.decideFact(principalId, decision)
        await this.changes.follow(decision.workspaceId, fact)
        return fact
    }
}
