import { Injectable } from "@nestjs/common"
import type { EntityManager } from "typeorm"
import { WorkspaceMembersService } from "@modules/domain/workspace-members"
import { InjectPrimaryEntityManager } from "@modules/platform/database"
import { InjectMessageCatalog } from "@modules/platform/i18n"
import type { MessageCatalog } from "@modules/platform/i18n"
import { InventoryError, InventoryErrorCode } from "./errors/inventory.error"
import type { SaveLocationParams } from "./inventory-operations.contracts"
import { clip, uuidOrNull } from "./policies/input-text.policy"
import { MANAGER_ROLES } from "./policies/access-roles.policy"
import { DEFAULT_LOCATION, SAVE_LOCATION } from "./persistence/inventory.sql"

/** The longest location name. */
const LOCATION_NAME_MAX = 60

interface LocationIdRow {
    readonly id: string | null
}

@Injectable()
/** The stock locations of a workspace (stores, warehouses): the default one every movement falls back to, and renaming. */
export class InventoryLocationsService {
    constructor(
        @InjectPrimaryEntityManager() private readonly entityManager: EntityManager,
        private readonly members: WorkspaceMembersService,
        @InjectMessageCatalog() private readonly catalog: MessageCatalog,
    ) {}

    /** The default location of the workspace; it is created on first use, and a concurrent creator is tolerated. */
    async defaultLocation(workspaceId: string): Promise<string> {
        const name = this.catalog.get("inventory.defaultLocationName", {}, "vi")
        const [row] = await this.entityManager.query<Array<LocationIdRow>>(DEFAULT_LOCATION, [workspaceId, name])
        if (row?.id === null || row?.id === undefined) {
            throw new InventoryError({ code: InventoryErrorCode.LocationNotCreated })
        }
        return row.id
    }

    /** Renames a location, or adds one next to the default. */
    async saveLocation(userId: string, workspaceId: string, request: SaveLocationParams): Promise<void> {
        await this.members.require(userId, workspaceId, MANAGER_ROLES)
        const name = clip(request.name, LOCATION_NAME_MAX)
        if (name === "") throw new InventoryError({ code: InventoryErrorCode.LocationNameRequired })
        const id = uuidOrNull(request.id)
        if (id === null) await this.defaultLocation(workspaceId)
        await this.entityManager.query(SAVE_LOCATION, [workspaceId, id, name])
    }
}
