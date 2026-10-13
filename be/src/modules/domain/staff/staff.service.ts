import { Injectable } from "@nestjs/common"
import type { EntityManager } from "typeorm"
import { InjectPrimaryEntityManager } from "@modules/platform/database"
import { StaffError, StaffErrorCode } from "./errors/staff.error"
import type { OptionalStaffName, StaffWrite } from "./staff.contracts"
import type { StaffRow } from "./persistence/staff.rows"
import { FIND_STAFF_NAME, INSERT_STAFF, LIST_STAFF, UPDATE_STAFF } from "./persistence/staff.sql"

/** The name a staff lookup answers. */
interface StaffNameRow {
    /** The display name. */
    readonly name: string
}

/** A name with its spaces collapsed. */
const collapsed = (value: string): string => value.trim().replace(/\s+/g, " ")

/** An email with its spaces removed, or null when there is none. */
const emailOf = (value: string | null | undefined): string | null => {
    if (value === null || value === undefined) return null
    const email = value.trim()
    return email === "" ? null : email
}

@Injectable()
/** The staff directory: the only owner of public.staff. */
export class StaffService {
    constructor(@InjectPrimaryEntityManager() private readonly entityManager: EntityManager) {}

    /** Lists the staff of the selected workspace, active first. Callers must prove membership before reading. */
    list(workspaceId: string): Promise<Array<StaffRow>> {
        return this.entityManager.query<Array<StaffRow>>(LIST_STAFF, [workspaceId])
    }

    /** The name of one staff row of the workspace, or null when there is none. */
    async nameOf(workspaceId: string, staffId: string): Promise<OptionalStaffName> {
        const rows = await this.entityManager.query<Array<StaffNameRow>>(FIND_STAFF_NAME, [workspaceId, staffId])
        return rows[0]?.name ?? null
    }

    /** Adds a staff row, or replaces one. The caller has already proved they may manage the workspace. */
    async save(input: StaffWrite): Promise<StaffRow> {
        const name = collapsed(input.name)
        if (name.length === 0) throw new StaffError({ code: StaffErrorCode.NameRequired })
        const values = [input.workspaceId, name, collapsed(input.role), emailOf(input.email), input.active ?? null]
        const rows = await this.write(input.id ?? null, values)
        const saved = rows[0]
        if (saved === undefined) throw new StaffError({ code: StaffErrorCode.NotFound })
        return saved
    }

    private write(id: string | null, values: ReadonlyArray<string | boolean | null>): Promise<Array<StaffRow>> {
        if (id === null) return this.entityManager.query<Array<StaffRow>>(INSERT_STAFF, [...values])
        const [workspaceId, name, role, email, active] = values
        return this.entityManager.query<Array<StaffRow>>(UPDATE_STAFF, [workspaceId, id, name, role, email, active])
    }
}
