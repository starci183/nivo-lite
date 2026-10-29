import { Injectable } from "@nestjs/common"
import type { EntityManager } from "typeorm"
import { Between, In } from "typeorm"
import { InjectPrimaryEntityManager } from "@modules/platform/database"
import type { ContractFacts, OptionalContractFacts } from "./contracts-read.contracts"
import { ContractEntity } from "./persistence/entities"

const FACT_COLUMNS = {
    id: true,
    customerName: true,
    leadId: true,
    plan: true,
    endsOn: true,
    amountVnd: true,
    status: true,
} as const

@Injectable()
/** Request-time reads of contracts for other capabilities, always scoped to the workspace and bounded by the caller. */
export class ContractsReadService {
    constructor(@InjectPrimaryEntityManager() private readonly entityManager: EntityManager) {}

    /** The contract of the workspace with this id; none when the workspace has no such contract. */
    async contractById(workspaceId: string, contractId: string): Promise<OptionalContractFacts> {
        const rows = await this.entityManager.find(ContractEntity, {
            select: FACT_COLUMNS,
            where: { workspaceId, id: contractId },
            take: 1,
        })
        return rows[0]
    }

    /** The contracts of the workspace with these ids, at most `limit`. */
    contractsByIds(workspaceId: string, contractIds: ReadonlyArray<string>, limit: number): Promise<Array<ContractFacts>> {
        return this.entityManager.find(ContractEntity, {
            select: FACT_COLUMNS,
            where: { workspaceId, id: In([...contractIds]) },
            take: limit,
        })
    }

    /** The active contracts of the workspace ending between two days (YYYY-MM-DD, both included), soonest first, at most `limit`. */
    activeEndingBetween(
        workspaceId: string,
        firstDay: string,
        lastDay: string,
        limit: number,
    ): Promise<Array<ContractFacts>> {
        return this.entityManager.find(ContractEntity, {
            select: FACT_COLUMNS,
            where: { workspaceId, status: "active", endsOn: Between(firstDay, lastDay) },
            order: { endsOn: "ASC", customerName: "ASC" },
            take: limit,
        })
    }
}
