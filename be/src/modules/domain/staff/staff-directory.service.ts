import { Injectable } from "@nestjs/common"
import type { EntityManager } from "typeorm"
import { InjectPrimaryEntityManager } from "@modules/platform/database"
import type { StaffRecord } from "./staff.contracts"
import { LIST_ACTIVE_STAFF, LIST_STAFF_NAMES } from "./persistence/staff.sql"

@Injectable()
/** Staff names and active choices for a caller whose workspace membership was proved by the composing service. */
export class StaffDirectoryService {
    constructor(@InjectPrimaryEntityManager() private readonly entityManager: EntityManager) {}

    /** The workspace's active staff choices, oldest first. */
    list(workspaceId: string): Promise<Array<StaffRecord>> {
        return this.entityManager.query<Array<StaffRecord>>(LIST_ACTIVE_STAFF, [workspaceId, 200])
    }

    /** The names of assigned people, including inactive staff. */
    namesOf(workspaceId: string, ids: ReadonlyArray<string>): Promise<Array<StaffRecord>> {
        if (ids.length === 0) return Promise.resolve([])
        return this.entityManager.query<Array<StaffRecord>>(LIST_STAFF_NAMES, [workspaceId, ids, ids.length])
    }
}
