import { Injectable } from "@nestjs/common"
import { In } from "typeorm"
import type { EntityManager } from "typeorm"
import { InjectPrimaryEntityManager } from "@modules/platform/database"
import { WorkspaceEntity } from "./persistence/entities"

/** A workspace as the platform team console lists it. */
export interface WorkspaceAdminRow {
    /** The workspace id. */
    readonly id: string
    /** The owning account. */
    readonly ownerId: string
    /** The workspace name. */
    readonly name: string
    /** The lifecycle state. */
    readonly status: string
    /** The plan, when one is bought. */
    readonly planCode: string | null
    /** Until when the plan is paid. */
    readonly paidUntil: Date | null
    /** When the workspace was created. */
    readonly createdAt: Date
}

/** The id and name of a workspace. */
export interface WorkspaceNameRow {
    /** The workspace id. */
    readonly id: string
    /** The workspace name. */
    readonly name: string
}

const ADMIN_COLUMNS = {
    id: true,
    ownerId: true,
    name: true,
    status: true,
    planCode: true,
    paidUntil: true,
    createdAt: true,
} as const

const toRow = (row: WorkspaceEntity): WorkspaceAdminRow => ({
    id: row.id,
    ownerId: row.ownerId,
    name: row.name,
    status: row.status,
    planCode: row.planCode,
    paidUntil: row.paidUntil,
    createdAt: row.createdAt,
})

@Injectable()
/** Workspace reads for the platform team console, which spans every workspace and so is scoped by nothing but a bound. */
export class WorkspaceAdminReadService {
    constructor(@InjectPrimaryEntityManager() private readonly entityManager: EntityManager) {}

    /** The newest workspaces, newest first. */
    async newest(limit: number): Promise<Array<WorkspaceAdminRow>> {
        const rows = await this.entityManager.find(WorkspaceEntity, {
            select: ADMIN_COLUMNS,
            order: { createdAt: "DESC" },
            take: limit,
        })
        return rows.map(toRow)
    }

    /** One workspace by id; undefined when it does not exist. */
    async find(workspaceId: string): Promise<WorkspaceAdminRow | undefined> {
        const row = await this.entityManager.findOne(WorkspaceEntity, {
            select: ADMIN_COLUMNS,
            where: { id: workspaceId },
        })
        return row === null ? undefined : toRow(row)
    }

    /** The names of the given workspaces, at most `limit`. */
    async namesOf(ids: ReadonlyArray<string>, limit: number): Promise<Array<WorkspaceNameRow>> {
        if (ids.length === 0) return []
        const rows = await this.entityManager.find(WorkspaceEntity, {
            select: { id: true, name: true },
            where: { id: In([...ids]) },
            take: limit,
        })
        return rows.map(({ id, name }) => ({ id, name }))
    }
}
