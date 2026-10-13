import { Injectable } from "@nestjs/common"
import type { EntityManager } from "typeorm"
import { InjectPrimaryEntityManager } from "@modules/platform/database"
import { INSERT_CONNECTOR_INTEREST } from "./persistence/connector-interest.sql"

@Injectable()
/** Owns the wish list of connectors: the one writer of connector_interest. */
export class ConnectorInterestService {
    constructor(@InjectPrimaryEntityManager() private readonly entityManager: EntityManager) {}

    /** Notes that a person of the workspace wants the connector; noting it again changes nothing. */
    async note(workspaceId: string, connectorId: string, userId: string): Promise<void> {
        await this.entityManager.query(INSERT_CONNECTOR_INTEREST, [workspaceId, connectorId, userId])
    }
}
