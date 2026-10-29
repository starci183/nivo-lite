import type { EntityManager, SelectQueryBuilder } from "typeorm"
import type { ChainStepRead } from "../work-chains.contracts"
import { WorkChainEntity } from "./entities"

/** A read of the steps of one workspace; the caller adds its own filter, order and bound and then names whoever acted. */
export const selectSteps = (manager: EntityManager, workspaceId: string): SelectQueryBuilder<WorkChainEntity> =>
    manager
        .createQueryBuilder(WorkChainEntity, "s")
        .select([
            "s.id AS id",
            "s.seq AS seq",
            "s.actor_kind AS actor_kind",
            "s.actor_id AS actor_id",
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

/** One step of the workspace without the name of whoever acted, or undefined when there is none with that id. */
export const readStepById = (
    manager: EntityManager,
    workspaceId: string,
    stepId: string,
): Promise<ChainStepRead | undefined> =>
    selectSteps(manager, workspaceId).andWhere("s.id = :stepId", { stepId }).limit(1).getRawOne<ChainStepRead>()
