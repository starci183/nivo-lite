import { builder } from "@starci/jest-preset"
import { graphNodesEntities } from "@modules/domain/graph-nodes"

const GraphNodeEffectEntity: (typeof graphNodesEntities)[0] = graphNodesEntities[0]
type GraphNodeEffectEntity = InstanceType<typeof GraphNodeEffectEntity>

/** The ledger row of the effect `core.send` that touched message m-1 in workspace ws-1, as the database answers it. */
export const effectRowOf: (overrides?: Partial<GraphNodeEffectEntity>) => GraphNodeEffectEntity =
    builder<GraphNodeEffectEntity>({
        id: "e-1",
        workspaceId: "ws-1",
        ledgerKey: "call:run:0",
        effect: "core.send",
        subjectKind: "message",
        subjectId: "m-1",
        createdAt: new Date(0),
        updatedAt: new Date(0),
    })
