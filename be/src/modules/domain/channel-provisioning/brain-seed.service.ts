import { Injectable } from "@nestjs/common"
import { ProfileSourcesService } from "@modules/domain/knowledge-sources"
import { WorkspacesService } from "@modules/domain/workspaces"
import { ConnectionsError, ConnectionsErrorCode } from "@modules/domain/connections"
import { eachInOrder } from "@modules/platform/primitives"
import { InjectChannelProvisioningOptions } from "./channel-provisioning.decorators"
import type { ChannelProvisioningOptions } from "./channel-provisioning.options"
import { readBrainSeeds } from "./brain-seed.policy"

/** The most workspaces looked through for the named one. */
const WORKSPACE_SCAN_LIMIT = 1000

const refused = (field: string): ConnectionsError =>
    new ConnectionsError({ code: ConnectionsErrorCode.CommandInvalid, params: { field } })

@Injectable()
/**
 * The seed of the Brain documents of a workspace: each document is kept as a knowledge source of the workspace (the same row and the same
 * indexing job as the knowledge page and the public documents), found again by the origin of its seed and its title. A rerun changes
 * nothing for a document that already holds the wanted text and queues a changed one again. It prints what it did.
 */
export class BrainSeedService {
    constructor(
        @InjectChannelProvisioningOptions() private readonly options: ChannelProvisioningOptions,
        private readonly sources: ProfileSourcesService,
        private readonly workspaces: WorkspacesService,
    ) {}

    /** Keeps the documents of the envelope read from `text` in the workspace named `workspaceName`; a refused document stops the run. */
    async run(text: string, workspaceName: string): Promise<void> {
        const seeds = readBrainSeeds(text)
        const { workspaceId, ownerId } = await this.workspaceOf(workspaceName)
        await eachInOrder(seeds, (seed) =>
            eachInOrder(seed.documents, async (document) => {
                const outcome = await this.sources.keep({
                    workspaceId,
                    ownerId,
                    origin: seed.origin,
                    title: document.title,
                    topic: document.topic,
                    module: document.module,
                    visibility: document.visibility,
                    content: document.content,
                })
                this.options.print(`brain ${seed.origin} ${document.visibility} ${document.title} ${outcome}`)
            }),
        )
    }

    private async workspaceOf(name: string): Promise<{ readonly workspaceId: string; readonly ownerId: string }> {
        const found = (await this.workspaces.list(WORKSPACE_SCAN_LIMIT)).filter((workspace) => workspace.name === name)
        const [only] = found
        if (only === undefined || found.length > 1) throw refused("workspace")
        const [ownerId] = await this.workspaces.ownerIdsOf([only.id], 1)
        if (ownerId === undefined) throw refused("workspace.owner")
        return { workspaceId: only.id, ownerId }
    }
}
