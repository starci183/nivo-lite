import { Injectable } from "@nestjs/common"
import { IsNull, MoreThanOrEqual, Not } from "typeorm"
import type { EntityManager } from "typeorm"
import { InjectPrimaryEntityManager } from "@modules/platform/database"
import { AppErrorEntity } from "./persistence/entities"

/** A captured error as the console lists it. */
export interface AppErrorRow {
    /** The error id. */
    readonly id: string
    /** Where it happened. */
    readonly scope: string
    /** The message. */
    readonly message: string
    /** The workspace it belongs to, when known. */
    readonly workspaceId: string | null
    /** When it was captured. */
    readonly createdAt: Date
}

/** How many errors one scope captured. */
export interface AppErrorScopeCount {
    /** The scope. */
    readonly scope: string
    /** The number of errors. */
    readonly count: number
}

const ROW_COLUMNS = { id: true, scope: true, message: true, workspaceId: true, createdAt: true } as const

const toRow = ({ id, scope, message, workspaceId, createdAt }: AppErrorEntity): AppErrorRow => ({
    id,
    scope,
    message,
    workspaceId,
    createdAt,
})

@Injectable()
/** Reads of the captured errors for the platform team console; the capture itself is AppErrorsService. */
export class AppErrorsReadService {
    constructor(@InjectPrimaryEntityManager() private readonly entityManager: EntityManager) {}

    /** The workspaces of the errors captured since an instant (one entry per error that names one), at most `limit`. */
    async workspacesSince(since: Date, limit: number): Promise<Array<string>> {
        const rows = await this.entityManager.find(AppErrorEntity, {
            select: { workspaceId: true },
            where: { createdAt: MoreThanOrEqual(since), workspaceId: Not(IsNull()) },
            take: limit,
        })
        return rows.flatMap(({ workspaceId }) => (workspaceId === null ? [] : [workspaceId]))
    }

    /** The newest errors of one workspace, newest first. */
    async latestOfWorkspace(workspaceId: string, limit: number): Promise<Array<AppErrorRow>> {
        const rows = await this.entityManager.find(AppErrorEntity, {
            select: ROW_COLUMNS,
            where: { workspaceId },
            order: { createdAt: "DESC" },
            take: limit,
        })
        return rows.map(toRow)
    }

    /** The newest errors of every workspace, newest first. */
    async latest(limit: number): Promise<Array<AppErrorRow>> {
        const rows = await this.entityManager.find(AppErrorEntity, {
            select: ROW_COLUMNS,
            order: { createdAt: "DESC" },
            take: limit,
        })
        return rows.map(toRow)
    }

    /** The errors captured since an instant counted by scope, most first, then by scope. */
    async scopesSince(since: Date, limit: number): Promise<Array<AppErrorScopeCount>> {
        const rows = await this.entityManager
            .createQueryBuilder(AppErrorEntity, "e")
            .select("e.scope", "scope")
            .addSelect("(count(*))::int", "count")
            .where("e.createdAt >= :since", { since })
            .groupBy("e.scope")
            .orderBy("count", "DESC")
            .addOrderBy("e.scope")
            .limit(limit)
            .getRawMany<AppErrorScopeCount>()
        return rows.map(({ scope, count }) => ({ scope, count }))
    }
}
