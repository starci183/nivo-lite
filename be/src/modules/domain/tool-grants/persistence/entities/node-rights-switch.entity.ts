import { Column, Entity } from "typeorm"

import { UuidAbstractEntity } from "@modules/platform/database"

@Entity({ schema: "public", name: "node_rights_switches" })
/**
 * The switch "node rights decide" of one workspace: off (or no row) = the agent's ticks decide every call, as before; on = a call
 * made inside a workflow node is decided by the node's policy rows. Beside it, what the flip read of the shadow compare.
 */
export class NodeRightsSwitchEntity extends UuidAbstractEntity {
    /** The workspace. */
    @Column({ name: "workspace_id", type: "uuid" })
    workspaceId!: string

    /** True when the node's rows decide a call made inside a node. */
    @Column({ name: "decides", type: "boolean" })
    decides!: boolean

    /** True when the last flip was forced past a shadow report that did not show full agreement. */
    @Column({ name: "forced", type: "boolean" })
    forced!: boolean

    /** The compared calls of the shadow report the last flip read. */
    @Column({ name: "compared", type: "bigint" })
    compared!: string

    /** Of them, the ones that differed. */
    @Column({ name: "differed", type: "bigint" })
    differed!: string
}
