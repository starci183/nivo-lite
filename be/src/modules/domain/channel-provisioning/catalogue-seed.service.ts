import { Injectable } from "@nestjs/common"
import { InventorySeedService } from "@modules/domain/inventory"
import { WorkspacesService } from "@modules/domain/workspaces"
import { ConnectionsError, ConnectionsErrorCode } from "@modules/domain/connections"
import { eachInOrder } from "@modules/platform/primitives"
import { InjectChannelProvisioningOptions } from "./channel-provisioning.decorators"
import type { ChannelProvisioningOptions } from "./channel-provisioning.options"
import { readCatalogueItems } from "./catalogue-seed.policy"

/** The most workspaces looked through for the named one. */
const WORKSPACE_SCAN_LIMIT = 1000

const refused = (field: string): ConnectionsError =>
    new ConnectionsError({ code: ConnectionsErrorCode.CommandInvalid, params: { field } })

@Injectable()
/**
 * The seed of a workspace catalogue: the items every shop of the workspace sells, written to the inventory items of the workspace
 * (the table is the workspace's own, no installation is needed). The sku is the key: a rerun changes nothing for an item that already
 * is the wanted one, and brings one that differs back to it, keeping its cost, stock levels and aliases. It prints what it did.
 */
export class CatalogueSeedService {
    constructor(
        @InjectChannelProvisioningOptions() private readonly options: ChannelProvisioningOptions,
        private readonly inventory: InventorySeedService,
        private readonly workspaces: WorkspacesService,
    ) {}

    /** Seeds the items of the envelope read from `text` into the workspace named `workspaceName`; a refused document stops the run. */
    async run(text: string, workspaceName: string): Promise<void> {
        const items = readCatalogueItems(text)
        const workspaceId = await this.workspaceOf(workspaceName)
        await eachInOrder(items, async (item) => {
            const { image, ...fields } = item
            const outcome = await this.inventory.ensureItem(workspaceId, {
                ...fields,
                ...(image === undefined ? {} : { image: { contentType: image.contentType, bytes: Buffer.from(image.base64, "base64") } }),
            })
            this.options.print(`catalogue ${item.sku} ${outcome}`)
        })
    }

    private async workspaceOf(name: string): Promise<string> {
        const found = (await this.workspaces.list(WORKSPACE_SCAN_LIMIT)).filter((workspace) => workspace.name === name)
        const [only] = found
        if (only === undefined || found.length > 1) throw refused("workspace")
        return only.id
    }
}
