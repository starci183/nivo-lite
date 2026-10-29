import { Injectable } from "@nestjs/common"
import type { EntityManager } from "typeorm"
import { InjectPrimaryEntityManager } from "@modules/platform/database"
import { ConnectionEntity } from "./persistence/entities"

/** The facts of a connection a payment feed reads before it records a credit. */
export interface ConnectionFeedState {
    /** The connection name. */
    readonly name: string
    /** The environment the connection runs in. */
    readonly environment: string
}

@Injectable()
/** Reads of one connection for the payment feeds, answered inside the feed's own transaction. */
export class ConnectionFeedReadsService {
    constructor(@InjectPrimaryEntityManager() private readonly entityManager: EntityManager) {}

    /** The workspace that owns the connection, or undefined when the connection is gone. */
    async workspaceOf(connectionId: string, manager: EntityManager = this.entityManager): Promise<string | undefined> {
        const row = await manager.findOne(ConnectionEntity, {
            select: { workspaceId: true },
            where: { id: connectionId },
        })
        return row === null ? undefined : row.workspaceId
    }

    /** The name and environment of the connection, or undefined when the connection is gone. */
    async stateOf(
        connectionId: string,
        manager: EntityManager = this.entityManager,
    ): Promise<ConnectionFeedState | undefined> {
        const row = await manager.findOne(ConnectionEntity, {
            select: { name: true, environment: true },
            where: { id: connectionId },
        })
        return row === null ? undefined : { name: row.name, environment: row.environment }
    }
}
