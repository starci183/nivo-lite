import { Injectable } from "@nestjs/common"
import type { EntityManager } from "typeorm"
import { InjectPrimaryEntityManager } from "@modules/platform/database"
import { StaffError, StaffErrorCode } from "./errors/staff.error"
import type { OptionalStaffName, StaffRow, StaffWrite } from "./staff.contracts"
import { StaffEntity } from "./persistence/entities"

/** The most staff rows one workspace lists. */
const STAFF_ROWS_MAX = 500

/** Maps an entity to the staff contract the accounting and shifts capabilities read. */
const rowOf = (staff: StaffEntity): StaffRow => ({
    id: staff.id,
    workspace_id: staff.workspaceId,
    name: staff.name,
    role: staff.role,
    email: staff.email,
    active: staff.active,
    created_at: staff.createdAt.toISOString(),
})

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
    async list(workspaceId: string): Promise<Array<StaffRow>> {
        const staff = await this.entityManager.find(StaffEntity, {
            where: { workspaceId },
            order: { active: "DESC", createdAt: "ASC", id: "ASC" },
            take: STAFF_ROWS_MAX,
        })
        return staff.map(rowOf)
    }

    /** The name of one staff row of the workspace, or null when there is none. */
    async nameOf(workspaceId: string, staffId: string): Promise<OptionalStaffName> {
        const staff = await this.entityManager.findOne(StaffEntity, {
            select: { name: true },
            where: { workspaceId, id: staffId },
        })
        return staff?.name ?? null
    }

    /** Adds a staff row, or replaces one. The caller has already proved they may manage the workspace. */
    async save(input: StaffWrite): Promise<StaffRow> {
        const name = collapsed(input.name)
        if (name.length === 0) throw new StaffError({ code: StaffErrorCode.NameRequired })
        const values = { name, role: collapsed(input.role), email: emailOf(input.email) }
        const saved =
            input.id === null || input.id === undefined
                ? await this.insert(input.workspaceId, values, input.active ?? true)
                : await this.update(input.workspaceId, input.id, values, input.active ?? null)
        if (saved === null) throw new StaffError({ code: StaffErrorCode.NotFound })
        return rowOf(saved)
    }

    private insert(
        workspaceId: string,
        values: Pick<StaffEntity, "name" | "role" | "email">,
        active: boolean,
    ): Promise<StaffEntity> {
        return this.entityManager.save(StaffEntity, { workspaceId, ...values, active })
    }

    /** Replaces the editable fields of a workspace's row; the active flag changes only when given. */
    private async update(
        workspaceId: string,
        id: string,
        values: Pick<StaffEntity, "name" | "role" | "email">,
        active: boolean | null,
    ): Promise<StaffEntity | null> {
        const result = await this.entityManager.update(
            StaffEntity,
            { workspaceId, id },
            active === null ? values : { ...values, active },
        )
        if (result.affected === 0) return null
        return this.entityManager.findOneBy(StaffEntity, { workspaceId, id })
    }
}
