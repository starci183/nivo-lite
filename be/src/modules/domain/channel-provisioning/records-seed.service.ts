import { Injectable } from "@nestjs/common"
import { ConnectionsError, ConnectionsErrorCode } from "@modules/domain/connections"
import { EntityEngineService, EntityMutationService } from "@modules/domain/entity-engine"
import { WorkspacesService } from "@modules/domain/workspaces"
import { eachInOrder } from "@modules/platform/primitives"
import { InjectChannelProvisioningOptions } from "./channel-provisioning.decorators"
import type { ChannelProvisioningOptions } from "./channel-provisioning.options"
import { readSeedRecords } from "./records-seed.policy"

/** The most workspaces looked through for the named one. */
const WORKSPACE_SCAN_LIMIT = 1000

const refused = (field: string): ConnectionsError =>
    new ConnectionsError({ code: ConnectionsErrorCode.CommandInvalid, params: { field } })

@Injectable()
/**
 * The seed of records of a workspace, through the entity engine: each record is an upsert under the unique key its document names, so a
 * module's own settings (Sales rules, for one) are written the way the module's action writes them, and the entity declaration refuses
 * a value it does not accept. A rerun writes the same values again. It prints what it did and never a value.
 */
export class RecordsSeedService {
    constructor(
        @InjectChannelProvisioningOptions() private readonly options: ChannelProvisioningOptions,
        private readonly engine: EntityEngineService,
        private readonly mutations: EntityMutationService,
        private readonly workspaces: WorkspacesService,
    ) {}

    /** Upserts the records of the envelope read from `text` in the workspace named `workspaceName`; a record the engine refuses stops the run. */
    async run(text: string, workspaceName: string): Promise<void> {
        const records = readSeedRecords(text)
        const workspaceId = await this.workspaceOf(workspaceName)
        await this.engine.scoped(workspaceId, (tx) =>
            eachInOrder(records, async (record) => {
                const result = await this.mutations.mutate(
                    tx,
                    { op: "upsert", entity: record.entity, on: record.on, values: record.values },
                    "job",
                )
                if (!result.ok) throw refused(`record.${record.entity}`)
                this.options.print(`records ${record.entity} saved`)
            }),
        )
    }

    private async workspaceOf(name: string): Promise<string> {
        const found = (await this.workspaces.list(WORKSPACE_SCAN_LIMIT)).filter((workspace) => workspace.name === name)
        const [only] = found
        if (only === undefined || found.length > 1) throw refused("workspace")
        return only.id
    }
}
