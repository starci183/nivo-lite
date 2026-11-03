import { Injectable } from "@nestjs/common"
import type { EntityManager } from "typeorm"
import { InventoryItemEntity } from "@modules/domain/inventory"
import { WorkspacesService } from "@modules/domain/workspaces"
import { ConnectionsError, ConnectionsErrorCode } from "@modules/domain/connections"
import { InjectPrimaryEntityManager, callDbFunction } from "@modules/platform/database"
import { InjectChannelProvisioningOptions } from "./channel-provisioning.decorators"
import type { ChannelProvisioningOptions } from "./channel-provisioning.options"
import type { CatalogueItem, CatalogueOutcome } from "./catalogue-seed.contracts"
import { readCatalogueItems } from "./catalogue-seed.policy"

/** The most workspaces looked through for the named one. */
const WORKSPACE_SCAN_LIMIT = 1000

const refused = (field: string): ConnectionsError =>
    new ConnectionsError({ code: ConnectionsErrorCode.CommandInvalid, params: { field } })

/** True when the stored item already is the wanted one: same name, unit and price, and on. */
const holds = (stored: InventoryItemEntity, wanted: CatalogueItem): boolean =>
    stored.name === wanted.name &&
    stored.unit === wanted.unit &&
    Number(stored.sellPriceVnd) === wanted.sellPriceVnd &&
    stored.active

@Injectable()
/**
 * The seed of a workspace catalogue: the items every shop of the workspace sells, written to the inventory items of the workspace
 * (the table is the workspace's own, no installation is needed). The sku is the key: a rerun changes nothing for an item that already
 * is the wanted one, and brings one that differs back to it, keeping its cost, stock levels and aliases. It prints what it did.
 */
export class CatalogueSeedService {
    constructor(
        @InjectChannelProvisioningOptions() private readonly options: ChannelProvisioningOptions,
        @InjectPrimaryEntityManager() private readonly entityManager: EntityManager,
        private readonly workspaces: WorkspacesService,
    ) {}

    /** Seeds the items of the envelope read from `text` into the workspace named `workspaceName`; a refused document stops the run. */
    async run(text: string, workspaceName: string): Promise<void> {
        const items = readCatalogueItems(text)
        const workspaceId = await this.workspaceOf(workspaceName)
        for (const item of items) {
            this.options.print(`catalogue ${item.sku} ${await this.ensure(workspaceId, item)}`)
        }
    }

    private async workspaceOf(name: string): Promise<string> {
        const found = (await this.workspaces.list(WORKSPACE_SCAN_LIMIT)).filter((workspace) => workspace.name === name)
        const [only] = found
        if (only === undefined || found.length > 1) throw refused("workspace")
        return only.id
    }

    private async ensure(workspaceId: string, item: CatalogueItem): Promise<CatalogueOutcome> {
        const stored = await this.entityManager.findOne(InventoryItemEntity, { where: { workspaceId, sku: item.sku } })
        if (stored !== null && holds(stored, item)) return "kept"
        await callDbFunction(this.entityManager, "public.inventory_save_item", [
            workspaceId,
            stored?.id ?? null,
            item.sku,
            item.name,
            item.unit,
            JSON.stringify(stored?.units ?? []),
            stored?.category ?? "",
            stored?.costVnd ?? 0,
            item.sellPriceVnd,
            stored?.reorderPoint ?? 0,
            stored?.reorderQty ?? 0,
            stored?.supplierId ?? null,
            stored?.aliases ?? [],
        ])
        if (stored !== null && !stored.active) {
            await callDbFunction(this.entityManager, "public.inventory_set_item_active", [workspaceId, stored.id, true])
        }
        return stored === null ? "created" : "updated"
    }
}
