import { Body, Controller, HttpCode, HttpStatus, Post } from "@nestjs/common"
import type { CommandBus } from "@nestjs/cqrs"
import { CurrentPrincipal } from "@modules/domain/identity"
import { WorkspaceId } from "@modules/domain/workspace-members"
import { InjectCommandBus } from "@modules/platform/cqrs"
import type { Principal } from "@modules/platform/cqrs"
import { SaveItemCommand } from "../../application/save-item.command"
import { toSaveItemRequest, toSaveItemResponse } from "./save-item.mapper"
import { SaveItemRequest as SaveItemHttpRequest } from "./dto/save-item.request"
import { SaveItemResponse } from "./dto/save-item.response"
import { SetItemActiveCommand } from "../../application/set-item-active.command"
import { toSetItemActiveRequest } from "./set-item-active.mapper"
import { SetItemActiveRequest as SetItemActiveHttpRequest } from "./dto/set-item-active.request"
import { SaveSupplierCommand } from "../../application/save-supplier.command"
import { toSaveSupplierRequest, toSaveSupplierResponse } from "./save-supplier.mapper"
import { SaveSupplierRequest as SaveSupplierHttpRequest } from "./dto/save-supplier.request"
import { SaveSupplierResponse } from "./dto/save-supplier.response"
import { SaveRecipeCommand } from "../../application/save-recipe.command"
import { toSaveRecipeRequest, toSaveRecipeResponse } from "./save-recipe.mapper"
import { SaveRecipeRequest as SaveRecipeHttpRequest } from "./dto/save-recipe.request"
import { SaveRecipeResponse } from "./dto/save-recipe.response"
import { DeleteRecipeCommand } from "../../application/delete-recipe.command"
import { toDeleteRecipeRequest } from "./delete-recipe.mapper"
import { DeleteRecipeRequest as DeleteRecipeHttpRequest } from "./dto/delete-recipe.request"
import { SaveLocationCommand } from "../../application/save-location.command"
import { toSaveLocationRequest } from "./save-location.mapper"
import { SaveLocationRequest as SaveLocationHttpRequest } from "./dto/save-location.request"
import { ImportPasteCommand } from "../../application/import-paste.command"
import { toImportPasteRequest, toImportPasteResponse } from "./import-paste.mapper"
import { ImportPasteRequest as ImportPasteHttpRequest } from "./dto/import-paste.request"
import { ImportPasteResponse } from "./dto/import-paste.response"
import { ApplyStarterCommand } from "../../application/apply-starter.command"
import { toApplyStarterRequest, toApplyStarterResponse } from "./apply-starter.mapper"
import { ApplyStarterRequest as ApplyStarterHttpRequest } from "./dto/apply-starter.request"
import { ApplyStarterResponse } from "./dto/apply-starter.response"
import { DeductOrderCommand } from "../../application/deduct-order.command"
import { toDeductOrderRequest } from "./deduct-order.mapper"
import { DeductOrderRequest as DeductOrderHttpRequest } from "./dto/deduct-order.request"
import { AdjustStockCommand } from "../../application/adjust-stock.command"
import { toAdjustStockRequest, toAdjustStockResponse } from "./adjust-stock.mapper"
import { AdjustStockRequest as AdjustStockHttpRequest } from "./dto/adjust-stock.request"
import { AdjustStockResponse } from "./dto/adjust-stock.response"
import { StockTakeCommand } from "../../application/stock-take.command"
import { toStockTakeRequest, toStockTakeResponse } from "./stock-take.mapper"
import { StockTakeRequest as StockTakeHttpRequest } from "./dto/stock-take.request"
import { StockTakeResponse } from "./dto/stock-take.response"
import { TransferStockCommand } from "../../application/transfer-stock.command"
import { toTransferStockRequest, toTransferStockResponse } from "./transfer-stock.mapper"
import { TransferStockRequest as TransferStockHttpRequest } from "./dto/transfer-stock.request"
import { TransferStockResponse } from "./dto/transfer-stock.response"
import { DraftLowStockCommand } from "../../application/draft-low-stock.command"
import { toDraftLowStockResponse } from "./draft-low-stock.mapper"
import { DraftLowStockResponse } from "./dto/draft-low-stock.response"
import { CreatePoCommand } from "../../application/create-po.command"
import { toCreatePoRequest, toCreatePoResponse } from "./create-po.mapper"
import { CreatePoRequest as CreatePoHttpRequest } from "./dto/create-po.request"
import { CreatePoResponse } from "./dto/create-po.response"
import { UpdatePoDraftCommand } from "../../application/update-po-draft.command"
import { toUpdatePoDraftRequest } from "./update-po-draft.mapper"
import { UpdatePoDraftRequest as UpdatePoDraftHttpRequest } from "./dto/update-po-draft.request"
import { RequestSendCommand } from "../../application/request-send.command"
import { toRequestSendRequest, toRequestSendResponse } from "./request-send.mapper"
import { RequestSendRequest as RequestSendHttpRequest } from "./dto/request-send.request"
import { RequestSendResponse } from "./dto/request-send.response"
import { CancelPoCommand } from "../../application/cancel-po.command"
import { toCancelPoRequest } from "./cancel-po.mapper"
import { CancelPoRequest as CancelPoHttpRequest } from "./dto/cancel-po.request"
import { ReceivePoCommand } from "../../application/receive-po.command"
import { toReceivePoRequest, toReceivePoResponse } from "./receive-po.mapper"
import { ReceivePoRequest as ReceivePoHttpRequest } from "./dto/receive-po.request"
import { ReceivePoResponse } from "./dto/receive-po.response"

@Controller("inventory")
/** HTTP door of the inventory feature: an authenticated door names its workspace in X-Workspace-Id and the service proves the membership. */
export class InventoryController {
    constructor(@InjectCommandBus() private readonly commandBus: CommandBus) {}

    /** Create or update one catalogue item. */
    @Post("items")
    async saveItem(
        @CurrentPrincipal() principal: Principal,
        @WorkspaceId() workspaceId: string,
        @Body() input: SaveItemHttpRequest,
    ): Promise<SaveItemResponse> {
        const result = await this.commandBus.execute(
            new SaveItemCommand({ request: toSaveItemRequest(input, workspaceId), principal }),
        )
        return toSaveItemResponse(result)
    }

    /** Switch an item on or off. */
    @Post("items/active")
    @HttpCode(HttpStatus.NO_CONTENT)
    async setItemActive(
        @CurrentPrincipal() principal: Principal,
        @WorkspaceId() workspaceId: string,
        @Body() input: SetItemActiveHttpRequest,
    ): Promise<void> {
        return this.commandBus.execute(
            new SetItemActiveCommand({ request: toSetItemActiveRequest(input, workspaceId), principal }),
        )
    }

    /** Create or update one supplier. */
    @Post("suppliers")
    async saveSupplier(
        @CurrentPrincipal() principal: Principal,
        @WorkspaceId() workspaceId: string,
        @Body() input: SaveSupplierHttpRequest,
    ): Promise<SaveSupplierResponse> {
        const result = await this.commandBus.execute(
            new SaveSupplierCommand({ request: toSaveSupplierRequest(input, workspaceId), principal }),
        )
        return toSaveSupplierResponse(result)
    }

    /** Create or update one recipe. */
    @Post("recipes")
    async saveRecipe(
        @CurrentPrincipal() principal: Principal,
        @WorkspaceId() workspaceId: string,
        @Body() input: SaveRecipeHttpRequest,
    ): Promise<SaveRecipeResponse> {
        const result = await this.commandBus.execute(
            new SaveRecipeCommand({ request: toSaveRecipeRequest(input, workspaceId), principal }),
        )
        return toSaveRecipeResponse(result)
    }

    /** Delete one recipe. */
    @Post("recipes/delete")
    @HttpCode(HttpStatus.NO_CONTENT)
    async deleteRecipe(
        @CurrentPrincipal() principal: Principal,
        @WorkspaceId() workspaceId: string,
        @Body() input: DeleteRecipeHttpRequest,
    ): Promise<void> {
        return this.commandBus.execute(
            new DeleteRecipeCommand({ request: toDeleteRecipeRequest(input, workspaceId), principal }),
        )
    }

    /** Create or rename one stock location. */
    @Post("locations")
    @HttpCode(HttpStatus.NO_CONTENT)
    async saveLocation(
        @CurrentPrincipal() principal: Principal,
        @WorkspaceId() workspaceId: string,
        @Body() input: SaveLocationHttpRequest,
    ): Promise<void> {
        return this.commandBus.execute(
            new SaveLocationCommand({ request: toSaveLocationRequest(input, workspaceId), principal }),
        )
    }

    /** Import items from a pasted table. */
    @Post("import")
    async importPaste(
        @CurrentPrincipal() principal: Principal,
        @WorkspaceId() workspaceId: string,
        @Body() input: ImportPasteHttpRequest,
    ): Promise<ImportPasteResponse> {
        const result = await this.commandBus.execute(
            new ImportPasteCommand({ request: toImportPasteRequest(input, workspaceId), principal }),
        )
        return toImportPasteResponse(result)
    }

    /** Load a starter set of suppliers, items and recipes. */
    @Post("starter")
    async applyStarter(
        @CurrentPrincipal() principal: Principal,
        @WorkspaceId() workspaceId: string,
        @Body() input: ApplyStarterHttpRequest,
    ): Promise<ApplyStarterResponse> {
        const result = await this.commandBus.execute(
            new ApplyStarterCommand({ request: toApplyStarterRequest(input, workspaceId), principal }),
        )
        return toApplyStarterResponse(result)
    }

    /** Take a confirmed order out of stock. */
    @Post("orders/deduct")
    @HttpCode(HttpStatus.NO_CONTENT)
    async deductOrder(
        @CurrentPrincipal() principal: Principal,
        @WorkspaceId() workspaceId: string,
        @Body() input: DeductOrderHttpRequest,
    ): Promise<void> {
        return this.commandBus.execute(
            new DeductOrderCommand({ request: toDeductOrderRequest(input, workspaceId), principal }),
        )
    }

    /** Change one item's quantity by hand. */
    @Post("stock/adjust")
    async adjustStock(
        @CurrentPrincipal() principal: Principal,
        @WorkspaceId() workspaceId: string,
        @Body() input: AdjustStockHttpRequest,
    ): Promise<AdjustStockResponse> {
        const result = await this.commandBus.execute(
            new AdjustStockCommand({ request: toAdjustStockRequest(input, workspaceId), principal }),
        )
        return toAdjustStockResponse(result)
    }

    /** Apply a stock count. */
    @Post("stock/count")
    async stockTake(
        @CurrentPrincipal() principal: Principal,
        @WorkspaceId() workspaceId: string,
        @Body() input: StockTakeHttpRequest,
    ): Promise<StockTakeResponse> {
        const result = await this.commandBus.execute(
            new StockTakeCommand({ request: toStockTakeRequest(input, workspaceId), principal }),
        )
        return toStockTakeResponse(result)
    }

    /** Move goods between two locations. */
    @Post("stock/transfer")
    async transferStock(
        @CurrentPrincipal() principal: Principal,
        @WorkspaceId() workspaceId: string,
        @Body() input: TransferStockHttpRequest,
    ): Promise<TransferStockResponse> {
        const result = await this.commandBus.execute(
            new TransferStockCommand({ request: toTransferStockRequest(input, workspaceId), principal }),
        )
        return toTransferStockResponse(result)
    }

    /** Draft purchase orders for low items. */
    @Post("orders/draft-low")
    async draftLowStock(
        @CurrentPrincipal() principal: Principal,
        @WorkspaceId() workspaceId: string,
    ): Promise<DraftLowStockResponse> {
        const result = await this.commandBus.execute(new DraftLowStockCommand({ request: { workspaceId }, principal }))
        return toDraftLowStockResponse(result)
    }

    /** Create a purchase order. */
    @Post("orders")
    async createPo(
        @CurrentPrincipal() principal: Principal,
        @WorkspaceId() workspaceId: string,
        @Body() input: CreatePoHttpRequest,
    ): Promise<CreatePoResponse> {
        const result = await this.commandBus.execute(
            new CreatePoCommand({ request: toCreatePoRequest(input, workspaceId), principal }),
        )
        return toCreatePoResponse(result)
    }

    /** Edit a draft purchase order. */
    @Post("orders/draft")
    @HttpCode(HttpStatus.NO_CONTENT)
    async updatePoDraft(
        @CurrentPrincipal() principal: Principal,
        @WorkspaceId() workspaceId: string,
        @Body() input: UpdatePoDraftHttpRequest,
    ): Promise<void> {
        return this.commandBus.execute(
            new UpdatePoDraftCommand({ request: toUpdatePoDraftRequest(input, workspaceId), principal }),
        )
    }

    /** Put a purchase order before the owner to send. */
    @Post("orders/send")
    async requestSend(
        @CurrentPrincipal() principal: Principal,
        @WorkspaceId() workspaceId: string,
        @Body() input: RequestSendHttpRequest,
    ): Promise<RequestSendResponse> {
        const result = await this.commandBus.execute(
            new RequestSendCommand({ request: toRequestSendRequest(input, workspaceId), principal }),
        )
        return toRequestSendResponse(result)
    }

    /** Cancel a purchase order. */
    @Post("orders/cancel")
    @HttpCode(HttpStatus.NO_CONTENT)
    async cancelPo(
        @CurrentPrincipal() principal: Principal,
        @WorkspaceId() workspaceId: string,
        @Body() input: CancelPoHttpRequest,
    ): Promise<void> {
        return this.commandBus.execute(
            new CancelPoCommand({ request: toCancelPoRequest(input, workspaceId), principal }),
        )
    }

    /** Receive goods against a purchase order. */
    @Post("orders/receive")
    async receivePo(
        @CurrentPrincipal() principal: Principal,
        @WorkspaceId() workspaceId: string,
        @Body() input: ReceivePoHttpRequest,
    ): Promise<ReceivePoResponse> {
        const result = await this.commandBus.execute(
            new ReceivePoCommand({ request: toReceivePoRequest(input, workspaceId), principal }),
        )
        return toReceivePoResponse(result)
    }
}
