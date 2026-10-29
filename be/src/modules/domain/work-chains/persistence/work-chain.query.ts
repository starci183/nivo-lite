import type { EntityManager, SelectQueryBuilder } from "typeorm"
import type { ChainStepRecord } from "../work-chains.contracts"
import { WorkChainEntity } from "./entities"

/**
 * A read of the steps of one workspace joined with the name of whoever acted: an agent name and module, or a member display name
 * and role. The caller adds its own filter, order and bound.
 */
export const selectStepsWithActor = (
    manager: EntityManager,
    workspaceId: string,
): SelectQueryBuilder<WorkChainEntity> =>
    manager
        .createQueryBuilder(WorkChainEntity, "s")
        .leftJoin("agents", "a", "s.actor_kind = 'agent' AND a.id = s.actor_id")
        .leftJoin(
            "workspace_members",
            "m",
            "s.actor_kind = 'member' AND m.id = s.actor_id AND m.workspace_id = s.workspace_id",
        )
        .select([
            "s.id AS id",
            "s.seq AS seq",
            "s.actor_kind AS actor_kind",
            "s.actor_id AS actor_id",
            "coalesce(a.name, m.display_name, '') AS actor_name",
            "coalesce(a.module, m.role, '') AS actor_role",
            "s.kind AS kind",
            "s.action AS action",
            "s.detail AS detail",
            "s.rule AS rule",
            "s.target AS target",
            "s.approval_request_id AS approval_request_id",
            "s.status AS status",
            "s.decided_by AS decided_by",
            "s.started_at AS started_at",
            "s.finished_at AS finished_at",
        ])
        .where("s.workspace_id = :workspaceId", { workspaceId })

/** One step of the workspace with the name of whoever acted, or undefined when there is none with that id. */
export const readStepById = (
    manager: EntityManager,
    workspaceId: string,
    stepId: string,
): Promise<ChainStepRecord | undefined> =>
    selectStepsWithActor(manager, workspaceId)
        .andWhere("s.id = :stepId", { stepId })
        .limit(1)
        .getRawOne<ChainStepRecord>()
