import { builder } from "@starci/jest-preset"
import { inventoryEntities } from "@modules/domain/inventory"

const [
    InventoryLocationEntity,
    InventorySupplierEntity,
    InventoryItemEntity,
    InventoryStockLevelEntity,
    InventoryMovementEntity,
    InventoryRecipeEntity,
    InventoryRecipeLineEntity,
    InventoryPurchaseOrderEntity,
    InventoryPoLineEntity,
] = inventoryEntities
type InventoryLocationEntity = InstanceType<typeof InventoryLocationEntity>
type InventorySupplierEntity = InstanceType<typeof InventorySupplierEntity>
type InventoryItemEntity = InstanceType<typeof InventoryItemEntity>
type InventoryStockLevelEntity = InstanceType<typeof InventoryStockLevelEntity>
type InventoryMovementEntity = InstanceType<typeof InventoryMovementEntity>
type InventoryRecipeEntity = InstanceType<typeof InventoryRecipeEntity>
type InventoryRecipeLineEntity = InstanceType<typeof InventoryRecipeLineEntity>
type InventoryPurchaseOrderEntity = InstanceType<typeof InventoryPurchaseOrderEntity>
type InventoryPoLineEntity = InstanceType<typeof InventoryPoLineEntity>

const AT = new Date("2026-10-01T00:00:00.000Z")

/** One catalogue item entity; a spec states only the fields it varies. */
const inventoryItemBase = builder<InventoryItemEntity>({
    id: "item-1",
    workspaceId: "ws-1",
    sku: "TEA",
    name: "Tea",
    unit: "kg",
    units: [],
    category: "",
    costVnd: "1000",
    sellPriceVnd: null,
    reorderPoint: "0",
    reorderQty: "0",
    supplierId: null,
    aliases: [],
    active: true,
    createdAt: AT,
    updatedAt: AT,
})

/** One stock location entity. */
const inventoryLocationBase = builder<InventoryLocationEntity>({
    id: "loc-1",
    workspaceId: "ws-1",
    name: "Main",
    isDefault: false,
    createdAt: AT,
    updatedAt: new Date("2026-01-01T00:00:00.000Z"),
})

/** One supplier entity. */
const inventorySupplierBase = builder<InventorySupplierEntity>({
    id: "sup-1",
    workspaceId: "ws-1",
    name: "Mill Co",
    contactName: "",
    email: null,
    phone: null,
    zalo: null,
    channel: "email",
    leadTimeDays: 2,
    paymentTerms: "",
    note: "",
    active: true,
    createdAt: AT,
    updatedAt: new Date("2026-01-01T00:00:00.000Z"),
})

/** One stock level entity. */
const inventoryStockLevelBase = builder<InventoryStockLevelEntity>({
    workspaceId: "ws-1",
    itemId: "item-1",
    locationId: "loc-1",
    qty: "0",
    updatedAt: AT,
    createdAt: new Date("2026-01-01T00:00:00.000Z"),
})

/** One stock movement entity. */
const inventoryMovementBase = builder<InventoryMovementEntity>({
    id: "mov-1",
    workspaceId: "ws-1",
    itemId: "item-1",
    locationId: "loc-1",
    kind: "in",
    qty: "1",
    qtyAfter: "1",
    unitCostVnd: null,
    reason: "",
    refType: "manual",
    refId: null,
    refLabel: null,
    byName: "NIVO",
    evidence: null,
    dedupeKey: null,
    createdAt: AT,
    updatedAt: AT,
})

/** One recipe entity. */
const inventoryRecipeBase = builder<InventoryRecipeEntity>({
    id: "rec-1",
    workspaceId: "ws-1",
    name: "Milk coffee",
    aliases: [],
    active: true,
    createdAt: AT,
    updatedAt: new Date("2026-01-01T00:00:00.000Z"),
})

/** One recipe line entity. */
const inventoryRecipeLineBase = builder<InventoryRecipeLineEntity>({
    id: "line-1",
    workspaceId: "ws-1",
    recipeId: "rec-1",
    itemId: "item-1",
    qty: "1",
    createdAt: new Date("2026-01-01T00:00:00.000Z"),
    updatedAt: new Date("2026-01-01T00:00:00.000Z"),
})

/** One purchase order entity. */
const inventoryPurchaseOrderBase = builder<InventoryPurchaseOrderEntity>({
    id: "po-1",
    workspaceId: "ws-1",
    poNo: "PO-202610-0001",
    supplierId: null,
    status: "draft",
    totalVnd: "0",
    expectedAt: null,
    message: "",
    sentAt: null,
    sentVia: null,
    sendNote: null,
    workItemId: null,
    note: "",
    source: "manual",
    createdBy: "NIVO",
    reminders: 0,
    createdAt: AT,
    updatedAt: AT,
})

/** One purchase order line entity. */
const inventoryPoLineBase = builder<InventoryPoLineEntity>({
    id: "line-1",
    workspaceId: "ws-1",
    poId: "po-1",
    itemId: "item-1",
    qtyOrdered: "1",
    qtyReceived: "0",
    unitCostVnd: "0",
    createdAt: new Date("2026-01-01T00:00:00.000Z"),
    updatedAt: new Date("2026-01-01T00:00:00.000Z"),
})

/** InventoryItemEntity with the fields a spec varies (the parameter is a plain mapped type, not a row literal). */
export const inventoryItemOf = (
    overrides: { [K in keyof InventoryItemEntity]?: InventoryItemEntity[K] } = {},
): InventoryItemEntity => inventoryItemBase(overrides)

/** InventoryLocationEntity with the fields a spec varies (the parameter is a plain mapped type, not a row literal). */
export const inventoryLocationOf = (
    overrides: { [K in keyof InventoryLocationEntity]?: InventoryLocationEntity[K] } = {},
): InventoryLocationEntity => inventoryLocationBase(overrides)

/** InventorySupplierEntity with the fields a spec varies (the parameter is a plain mapped type, not a row literal). */
export const inventorySupplierOf = (
    overrides: { [K in keyof InventorySupplierEntity]?: InventorySupplierEntity[K] } = {},
): InventorySupplierEntity => inventorySupplierBase(overrides)

/** InventoryStockLevelEntity with the fields a spec varies (the parameter is a plain mapped type, not a row literal). */
export const inventoryStockLevelOf = (
    overrides: { [K in keyof InventoryStockLevelEntity]?: InventoryStockLevelEntity[K] } = {},
): InventoryStockLevelEntity => inventoryStockLevelBase(overrides)

/** InventoryMovementEntity with the fields a spec varies (the parameter is a plain mapped type, not a row literal). */
export const inventoryMovementOf = (
    overrides: { [K in keyof InventoryMovementEntity]?: InventoryMovementEntity[K] } = {},
): InventoryMovementEntity => inventoryMovementBase(overrides)

/** InventoryRecipeEntity with the fields a spec varies (the parameter is a plain mapped type, not a row literal). */
export const inventoryRecipeOf = (
    overrides: { [K in keyof InventoryRecipeEntity]?: InventoryRecipeEntity[K] } = {},
): InventoryRecipeEntity => inventoryRecipeBase(overrides)

/** InventoryRecipeLineEntity with the fields a spec varies (the parameter is a plain mapped type, not a row literal). */
export const inventoryRecipeLineOf = (
    overrides: { [K in keyof InventoryRecipeLineEntity]?: InventoryRecipeLineEntity[K] } = {},
): InventoryRecipeLineEntity => inventoryRecipeLineBase(overrides)

/** InventoryPurchaseOrderEntity with the fields a spec varies (the parameter is a plain mapped type, not a row literal). */
export const inventoryPurchaseOrderOf = (
    overrides: { [K in keyof InventoryPurchaseOrderEntity]?: InventoryPurchaseOrderEntity[K] } = {},
): InventoryPurchaseOrderEntity => inventoryPurchaseOrderBase(overrides)

/** InventoryPoLineEntity with the fields a spec varies (the parameter is a plain mapped type, not a row literal). */
export const inventoryPoLineOf = (
    overrides: { [K in keyof InventoryPoLineEntity]?: InventoryPoLineEntity[K] } = {},
): InventoryPoLineEntity => inventoryPoLineBase(overrides)
