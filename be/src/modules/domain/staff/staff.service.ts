import { Injectable } from "@nestjs/common"
import type { EntityManager } from "typeorm"
import { InjectPrimaryEntityManager } from "@modules/platform/database"
import type { StaffRow } from "./persistence/staff.rows"
import { LIST_STAFF } from "./persistence/staff.sql"

@Injectable()
/** Reads the staff assignment directory; this capability owns the public.staff read model. */
export class StaffService {
    constructor(@InjectPrimaryEntityManager() private readonly entityManager: EntityManager) {}
    /** Lists the staff of the selected workspace. Callers must prove membership before reading. */
    list(workspaceId: string): Promise<Array<StaffRow>> {
        return this.entityManager.query<Array<StaffRow>>(LIST_STAFF, [workspaceId])
    }
}
