import { Injectable } from "@nestjs/common"
import { In, Not } from "typeorm"
import type { EntityManager } from "typeorm"
import { InjectPrimaryEntityManager } from "@modules/platform/database"
import type { ContentPillar, ContentPillarDraft } from "./content-pillars.contracts"
import { toContentPillar } from "./content-pillars.mapper"
import { ContentPillarEntity } from "./persistence/entities"

/** The most themes one lookup by id answers. */
const KNOWN_MAX = 100

@Injectable()
/** The sole owner of content_pillars reads and writes. */
export class ContentPillarsService {
    constructor(@InjectPrimaryEntityManager() private readonly entityManager: EntityManager) {}

    /** Lists saved themes for authorized application orchestration. */
    async list(workspaceId: string, transaction: EntityManager = this.entityManager): Promise<Array<ContentPillar>> {
        const rows = await transaction.find(ContentPillarEntity, {
            where: { workspaceId },
            order: { sort: "ASC", createdAt: "ASC" },
            take: 100,
        })
        return rows.map(toContentPillar)
    }

    /** The ids among `ids` that are themes of the workspace. */
    async known(
        workspaceId: string,
        ids: ReadonlyArray<string>,
        transaction: EntityManager = this.entityManager,
    ): Promise<ReadonlyArray<string>> {
        const rows = await transaction.find(ContentPillarEntity, {
            where: { workspaceId, id: In([...ids]) },
            select: { id: true },
            take: KNOWN_MAX,
        })
        return rows.map((row) => row.id)
    }

    /** True when the workspace has a theme with this id. */
    exists(workspaceId: string, id: string, transaction: EntityManager = this.entityManager): Promise<boolean> {
        return transaction.exists(ContentPillarEntity, { where: { workspaceId, id } })
    }

    /** How many themes planning uses. */
    countActive(workspaceId: string): Promise<number> {
        return this.entityManager.count(ContentPillarEntity, { where: { workspaceId, active: true } })
    }

    /** How many of the themes among `ids` planning uses. */
    countActiveAmong(workspaceId: string, ids: ReadonlyArray<string>): Promise<number> {
        return this.entityManager.count(ContentPillarEntity, { where: { workspaceId, active: true, id: In([...ids]) } })
    }

    /** Replaces themes inside the caller's workspace configuration transaction. */
    async replace(
        transaction: EntityManager,
        workspaceId: string,
        rows: ReadonlyArray<ContentPillarDraft>,
    ): Promise<void> {
        const retainedIds = rows.flatMap((row) => (row.id === undefined ? [] : [row.id]))
        await transaction.delete(
            ContentPillarEntity,
            retainedIds.length === 0 ? { workspaceId } : { workspaceId, id: Not(In(retainedIds)) },
        )
        // An empty replacement keeps nothing: an insert without values would write a row of defaults.
        if (rows.length === 0) return
        await transaction.update(
            ContentPillarEntity,
            { workspaceId, id: In(retainedIds) },
            { name: () => "'edit:' || gen_random_uuid()::text" },
        )
        await transaction
            .createQueryBuilder(ContentPillarEntity, "content_pillars")
            .insert()
            .values(
                rows.map((row, sort) => ({
                    ...(row.id === undefined ? {} : { id: row.id }),
                    workspaceId,
                    name: row.name.trim(),
                    description: row.description.trim(),
                    weight: row.weight,
                    active: row.active,
                    sort,
                })),
            )
            .orUpdate(["name", "description", "weight", "active", "sort"], ["id"], {
                overwriteCondition: { where: "content_pillars.workspace_id = :workspaceId" },
            })
            .setParameter("workspaceId", workspaceId)
            .execute()
    }
}
