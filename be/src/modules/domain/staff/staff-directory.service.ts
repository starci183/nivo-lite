import { Injectable } from "@nestjs/common"
import { In } from "typeorm"
import type { EntityManager } from "typeorm"
import { InjectPrimaryEntityManager } from "@modules/platform/database"
import type { StaffRecord } from "./staff.contracts"
import { StaffEntity } from "./persistence/entities"

/** The most active staff choices one list offers. */
const ACTIVE_STAFF_MAX = 200

@Injectable()
/** Staff names and active choices for a caller whose workspace membership was proved by the composing service. */
export class StaffDirectoryService {
    constructor(@InjectPrimaryEntityManager() private readonly entityManager: EntityManager) {}

    /** The workspace's active staff choices, oldest first. */
    async list(workspaceId: string): Promise<Array<StaffRecord>> {
        const staff = await this.entityManager.find(StaffEntity, {
            select: { id: true, name: true },
            where: { workspaceId, active: true },
            order: { createdAt: "ASC", id: "ASC" },
            take: ACTIVE_STAFF_MAX,
        })
        return staff.map(({ id, name }) => ({ id, name }))
    }

    /** The names of assigned people, including inactive staff. */
    async namesOf(workspaceId: string, ids: ReadonlyArray<string>): Promise<Array<StaffRecord>> {
        if (ids.length === 0) return []
        const staff = await this.entityManager.find(StaffEntity, {
            select: { id: true, name: true },
            where: { workspaceId, id: In([...ids]) },
            take: ids.length,
        })
        return staff.map(({ id, name }) => ({ id, name }))
    }
}
