import { Injectable, Optional } from "@nestjs/common"
import type { OnModuleInit } from "@nestjs/common"
import type { NodeQuery } from "@nivo-lite/agent-sdk/node"
import type { EntityManager } from "typeorm"
import { GraphNodeRegistryService, rowsAnswering } from "@modules/domain/graph-nodes"
import type { NodeRow, NodeTurn } from "@modules/domain/graph-nodes"
import { InjectPrimaryEntityManager } from "@modules/platform/database"
import { InjectInventoryPublicApiUrl } from "./inventory.decorators"
import { productImageUrlOf } from "./inventory-image.policy"
import { InventoryItemEntity } from "./persistence/entities"

/** The most catalogue items one read looks through. */
const CATALOGUE_LIMIT = 500

/** The item as the `catalogue-item` data kind names its fields; a price the shop has not set stays null, and so does the photo link of an item without a photo. */
const rowOf = (item: InventoryItemEntity, publicApiUrl: string): NodeRow => ({
    id: item.id,
    sku: item.sku,
    name: item.name,
    unit: item.unit,
    priceVnd: item.sellPriceVnd === null ? null : Number(item.sellPriceVnd),
    active: item.active,
    imageUrl: productImageUrlOf(publicApiUrl, item.id, item.imagePath),
    imageType: item.imagePath === null ? null : item.imageType,
})

@Injectable()
/**
 * The shop's catalogue as graph nodes see it: the `catalogue-item` data port, over the inventory items. The catalogue belongs to the
 * workspace and is linked to no turn, so a turn read and a workspace read answer the same workspace's items, and no other's.
 */
export class InventoryGraphService implements OnModuleInit {
    constructor(
        @InjectPrimaryEntityManager() private readonly entityManager: EntityManager,
        @InjectInventoryPublicApiUrl() private readonly publicApiUrl: string,
        @Optional() private readonly registry?: GraphNodeRegistryService,
    ) {}

    /** Registers the port when the app hosts graph nodes; otherwise there is nothing to serve. */
    onModuleInit(): void {
        this.registry?.addDataPort({ kind: "catalogue-item", read: (turn, query) => this.read(turn, query) })
    }

    private async read(turn: NodeTurn, query: NodeQuery): Promise<ReadonlyArray<NodeRow>> {
        const items = await this.entityManager.find(InventoryItemEntity, {
            where: { workspaceId: turn.workspaceId },
            order: { name: "ASC" },
            take: CATALOGUE_LIMIT,
        })
        return rowsAnswering(items.map((item) => rowOf(item, this.publicApiUrl)), query)
    }
}
