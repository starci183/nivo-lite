import { Injectable } from "@nestjs/common"
import type { EntityManager } from "typeorm"
import type { LeadDesk, LeadDeskCard } from "@modules/domain/responsibilities"
import { LeadReadService } from "./lead-read.service"
import { LeadRecordsService } from "./lead-records.service"

@Injectable()
/** The customers the steps of the responsibilities journal belong to: the leads capability answers them through the port that capability defines. */
export class LeadDeskService implements LeadDesk {
    constructor(
        private readonly reads: LeadReadService,
        private readonly records: LeadRecordsService,
    ) {}

    /** The cards of the given customers of the workspace. */
    async cardsOf(workspaceId: string, leadIds: ReadonlyArray<string>): Promise<Array<LeadDeskCard>> {
        const cards = await this.reads.cardsOf(workspaceId, leadIds)
        return cards.map((card) => ({
            id: card.id,
            contactName: card.contactName,
            company: card.company,
            stage: card.stage,
        }))
    }

    /** Holds the customer in the caller's transaction. */
    hold(workspaceId: string, leadId: string, manager: EntityManager): Promise<boolean> {
        return this.records.hold(workspaceId, leadId, manager)
    }
}
