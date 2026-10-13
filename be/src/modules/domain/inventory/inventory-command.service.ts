import { Injectable } from "@nestjs/common"
import type { EntityManager } from "typeorm"
import { InjectPrimaryEntityManager } from "@modules/platform/database"
import { DomainError } from "@modules/platform/errors"
import { InjectMessageCatalog } from "@modules/platform/i18n"
import type { MessageCatalog } from "@modules/platform/i18n"
import { InjectLogger } from "@modules/platform/logging"
import type { Logger } from "@modules/platform/logging"
import { isInventoryCommandPayload } from "@modules/queues/inventory-command"
import { InventoryCatalogService } from "./inventory-catalog.service"
import { InventoryDispatchService } from "./inventory-dispatch.service"
import { InventoryImportService } from "./inventory-import.service"
import { InventoryLocationsService } from "./inventory-locations.service"
import { InventoryOrdersService } from "./inventory-orders.service"
import { InventoryReceivingService } from "./inventory-receiving.service"
import { InventoryReplenishService } from "./inventory-replenish.service"
import { InventoryStockService } from "./inventory-stock.service"
import { InventoryLogEvent } from "./inventory.log-events"
import { decodeCommand } from "./policies/command-input.policy"
import type { InventoryCommandRequest } from "./policies/command-input.policy"
import { FINISH_COMMAND, SELECT_COMMAND } from "./persistence/inventory.sql"
import type { InventoryCommandsRow } from "./persistence/inventory.rows"

/** The code a command that failed without a refusal in words is settled with. */
const COMMAND_FAILED_CODE = "INVENTORY_COMMAND_FAILED"

/** What one settled command stores: its status, result and refusal. */
interface Settlement {
    readonly status: "done" | "failed"
    readonly result: object | null
    readonly code: string | null
    readonly message: string | null
}

@Injectable()
/** Runs the commands members submit from the web app: each runs through the domain service it names, as the member who submitted it, and the answer is written back on the command row. */
export class InventoryCommandService {
    constructor(
        @InjectPrimaryEntityManager() private readonly entityManager: EntityManager,
        @InjectMessageCatalog() private readonly catalog: MessageCatalog,
        @InjectLogger() private readonly logger: Logger,
        private readonly catalogue: InventoryCatalogService,
        private readonly importing: InventoryImportService,
        private readonly locations: InventoryLocationsService,
        private readonly stock: InventoryStockService,
        private readonly orders: InventoryOrdersService,
        private readonly dispatch: InventoryDispatchService,
        private readonly receiving: InventoryReceivingService,
        private readonly replenish: InventoryReplenishService,
    ) {}

    /** The effect of one inventory-command job; a payload of any other job changes nothing. */
    async runJob(payload: object): Promise<void> {
        if (isInventoryCommandPayload(payload)) await this.run(payload.commandId, payload.workspaceId)
    }

    /** Runs one queued command and settles it; a command already settled, or unknown, changes nothing. */
    async run(commandId: string, workspaceId: string): Promise<void> {
        const [row] = await this.entityManager.query<Array<InventoryCommandsRow>>(SELECT_COMMAND, [
            commandId,
            workspaceId,
        ])
        if (row === undefined || row.status !== "queued") return
        const settlement = await this.settle(row)
        await this.entityManager.query(FINISH_COMMAND, [
            row.id,
            settlement.status,
            settlement.result === null ? null : JSON.stringify(settlement.result),
            settlement.code,
            settlement.message,
        ])
    }

    private async settle(row: InventoryCommandsRow): Promise<Settlement> {
        try {
            const request = decodeCommand(row.kind, row.input)
            if (request === null) return this.failed(COMMAND_FAILED_CODE, {})
            return {
                status: "done",
                result: await this.execute(request, row.created_by, row.workspace_id),
                code: null,
                message: null,
            }
        } catch (cause) {
            if (cause instanceof DomainError) return this.failed(cause.code, cause.params)
            this.logger.error(InventoryLogEvent.CommandFailed, { commandId: row.id, kind: row.kind })
            return this.failed(COMMAND_FAILED_CODE, {})
        }
    }

    private failed(code: string, params: Record<string, string | number>): Settlement {
        const key = code === COMMAND_FAILED_CODE ? "inventory.commandFailed" : `errors.${code}`
        return { status: "failed", result: null, code, message: this.catalog.get(key, params, "vi") }
    }

    private execute(
        request: InventoryCommandRequest,
        userId: string,
        workspaceId: string,
    ): Promise<object | null> {
        switch (request.kind) {
            case "save-item":
                return this.catalogue.saveItem(userId, workspaceId, request.params)
            case "set-item-active":
                return this.nothing(this.catalogue.setItemActive(userId, workspaceId, request.params))
            case "save-supplier":
                return this.catalogue.saveSupplier(userId, workspaceId, request.params)
            case "save-recipe":
                return this.catalogue.saveRecipe(userId, workspaceId, request.params)
            case "delete-recipe":
                return this.nothing(this.catalogue.deleteRecipe(userId, workspaceId, request.params))
            case "save-location":
                return this.nothing(this.locations.saveLocation(userId, workspaceId, request.params))
            case "import-paste":
                return this.importing.importPasted(userId, workspaceId, request.params)
            case "apply-starter":
                return this.importing.applyStarter(userId, workspaceId, request.params)
            case "adjust-stock":
                return this.stock.adjustStock(userId, workspaceId, request.params)
            case "stock-take":
                return this.stock.stockTake(userId, workspaceId, request.params)
            case "transfer-stock":
                return this.stock.transferStock(userId, workspaceId, request.params)
            case "draft-low-stock":
                return this.replenish.draftLowStock(userId, workspaceId)
            case "create-po":
                return this.orders.createPo(userId, workspaceId, request.params)
            case "update-po-draft":
                return this.nothing(this.orders.updatePoDraft(userId, workspaceId, request.params))
            case "request-send":
                return this.dispatch.requestSend(userId, workspaceId, request.params)
            case "cancel-po":
                return this.nothing(this.orders.cancelPo(userId, workspaceId, request.params))
            case "receive-po":
                return this.receiving.receivePo(userId, workspaceId, request.params)
        }
    }

    private async nothing(done: Promise<void>): Promise<null> {
        await done
        return null
    }
}
