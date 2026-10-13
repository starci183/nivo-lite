import type {
    AdjustStockParams,
    ApplyStarterParams,
    CancelPoParams,
    CreatePoParams,
    DeleteRecipeParams,
    ImportPasteParams,
    ReceivePoParams,
    RequestSendParams,
    SaveItemParams,
    SaveLocationParams,
    SaveRecipeParams,
    SaveSupplierParams,
    SetItemActiveParams,
    StockTakeParams,
    TransferStockParams,
    UpdatePoDraftParams,
} from "../inventory-operations.contracts"

/** One command a member submitted, decoded to the parameters of the domain service that runs it. */
export type InventoryCommandRequest =
    | { readonly kind: "save-item"; readonly params: SaveItemParams }
    | { readonly kind: "set-item-active"; readonly params: SetItemActiveParams }
    | { readonly kind: "save-supplier"; readonly params: SaveSupplierParams }
    | { readonly kind: "save-recipe"; readonly params: SaveRecipeParams }
    | { readonly kind: "delete-recipe"; readonly params: DeleteRecipeParams }
    | { readonly kind: "save-location"; readonly params: SaveLocationParams }
    | { readonly kind: "import-paste"; readonly params: ImportPasteParams }
    | { readonly kind: "apply-starter"; readonly params: ApplyStarterParams }
    | { readonly kind: "adjust-stock"; readonly params: AdjustStockParams }
    | { readonly kind: "stock-take"; readonly params: StockTakeParams }
    | { readonly kind: "transfer-stock"; readonly params: TransferStockParams }
    | { readonly kind: "draft-low-stock" }
    | { readonly kind: "create-po"; readonly params: CreatePoParams }
    | { readonly kind: "update-po-draft"; readonly params: UpdatePoDraftParams }
    | { readonly kind: "request-send"; readonly params: RequestSendParams }
    | { readonly kind: "cancel-po"; readonly params: CancelPoParams }
    | { readonly kind: "receive-po"; readonly params: ReceivePoParams }

type Fields = Readonly<Record<string, unknown>>

const fieldsOf = (value: unknown): Fields =>
    typeof value === "object" && value !== null && !Array.isArray(value)
        ? Object.fromEntries(Object.entries(value))
        : {}

const text = (fields: Fields, key: string): string => {
    const value = fields[key]
    return typeof value === "string" ? value : ""
}

const maybeText = (fields: Fields, key: string): string | undefined => {
    const value = fields[key]
    return typeof value === "string" ? value : undefined
}

const count = (fields: Fields, key: string): number => {
    const value = fields[key]
    return typeof value === "number" && Number.isFinite(value) ? value : 0
}

const maybeCount = (fields: Fields, key: string): number | undefined => {
    const value = fields[key]
    return typeof value === "number" && Number.isFinite(value) ? value : undefined
}

const rows = (fields: Fields, key: string): ReadonlyArray<Fields> => {
    const value = fields[key]
    return Array.isArray(value) ? value.map(fieldsOf) : []
}

const texts = (fields: Fields, key: string): ReadonlyArray<string> => {
    const value = fields[key]
    return Array.isArray(value) ? value.filter((entry): entry is string => typeof entry === "string") : []
}

/** The pair `{ key: value }`, or nothing when the value is absent (optional fields are left out, never undefined). */
const given = <Value>(key: string, value: Value | undefined): Readonly<Record<string, Value>> =>
    value === undefined ? {} : { [key]: value }

const decodeItem = (fields: Fields): SaveItemParams => ({
    ...given("id", maybeText(fields, "id")),
    sku: text(fields, "sku"),
    name: text(fields, "name"),
    unit: text(fields, "unit"),
    units: text(fields, "units"),
    category: text(fields, "category"),
    cost: text(fields, "cost"),
    sell: text(fields, "sell"),
    reorderPoint: text(fields, "reorderPoint"),
    reorderQty: text(fields, "reorderQty"),
    supplierId: text(fields, "supplierId"),
    aliases: text(fields, "aliases"),
    ...given("openingQty", maybeText(fields, "openingQty")),
})

const decodeSupplier = (fields: Fields): SaveSupplierParams => ({
    ...given("id", maybeText(fields, "id")),
    name: text(fields, "name"),
    contactName: text(fields, "contactName"),
    email: text(fields, "email"),
    phone: text(fields, "phone"),
    zalo: text(fields, "zalo"),
    channel: text(fields, "channel"),
    leadTime: text(fields, "leadTime"),
    terms: text(fields, "terms"),
    note: text(fields, "note"),
})

const decodeStarter = (fields: Fields): ApplyStarterParams => ({
    name: text(fields, "name"),
    suppliers: rows(fields, "suppliers").map((supplier) => ({
        name: text(supplier, "name"),
        ...given("contactName", maybeText(supplier, "contactName")),
        ...given("email", maybeText(supplier, "email")),
        ...given("phone", maybeText(supplier, "phone")),
        ...given("zalo", maybeText(supplier, "zalo")),
        channel: text(supplier, "channel"),
        leadTimeDays: count(supplier, "leadTimeDays"),
        ...given("paymentTerms", maybeText(supplier, "paymentTerms")),
    })),
    items: rows(fields, "items").map((item) => ({
        sku: text(item, "sku"),
        name: text(item, "name"),
        unit: text(item, "unit"),
        ...(Array.isArray(item.units)
            ? {
                  units: rows(item, "units").map((unit) => ({
                      unit: text(unit, "unit"),
                      factor: count(unit, "factor"),
                  })),
              }
            : {}),
        category: text(item, "category"),
        costVnd: count(item, "costVnd"),
        ...given("sellPriceVnd", maybeCount(item, "sellPriceVnd")),
        reorderPoint: count(item, "reorderPoint"),
        reorderQty: count(item, "reorderQty"),
        ...given("supplier", maybeText(item, "supplier")),
        ...(Array.isArray(item.aliases) ? { aliases: texts(item, "aliases") } : {}),
        qty: count(item, "qty"),
    })),
    recipes: rows(fields, "recipes").map((recipe) => ({
        name: text(recipe, "name"),
        ...(Array.isArray(recipe.aliases) ? { aliases: texts(recipe, "aliases") } : {}),
        lines: rows(recipe, "lines").map((line) => ({ sku: text(line, "sku"), qty: count(line, "qty") })),
    })),
})

const decodeAdjust = (fields: Fields): AdjustStockParams => ({
    itemId: text(fields, "itemId"),
    ...given("locationId", maybeText(fields, "locationId")),
    ...given("delta", maybeCount(fields, "delta")),
    ...given("counted", maybeCount(fields, "counted")),
    reason: text(fields, "reason"),
})

const decodeLines = (fields: Fields) =>
    rows(fields, "lines").map((line) => ({
        lineId: text(line, "lineId"),
        qty: text(line, "qty"),
        unitCost: text(line, "unitCost"),
    }))

/** Decodes the stored input of one command; null for a kind this capability does not run. Fields that are missing or of the wrong type become empty, which the services refuse in words. */
export const decodeCommand = (kind: string, input: unknown): InventoryCommandRequest | null => {
    const fields = fieldsOf(input)
    switch (kind) {
        case "save-item":
            return { kind, params: decodeItem(fields) }
        case "set-item-active":
            return { kind, params: { id: text(fields, "id"), active: fields.active === true } }
        case "save-supplier":
            return { kind, params: decodeSupplier(fields) }
        case "save-recipe":
            return {
                kind,
                params: {
                    ...given("id", maybeText(fields, "id")),
                    name: text(fields, "name"),
                    aliases: text(fields, "aliases"),
                    lines: rows(fields, "lines").map((line) => ({
                        itemId: text(line, "itemId"),
                        qty: text(line, "qty"),
                    })),
                },
            }
        case "delete-recipe":
            return { kind, params: { id: text(fields, "id") } }
        case "save-location":
            return { kind, params: { ...given("id", maybeText(fields, "id")), name: text(fields, "name") } }
        case "import-paste":
            return { kind, params: { raw: text(fields, "raw") } }
        case "apply-starter":
            return { kind, params: decodeStarter(fields) }
        case "adjust-stock":
            return { kind, params: decodeAdjust(fields) }
        case "stock-take":
            return {
                kind,
                params: {
                    counts: rows(fields, "counts").map((line) => ({
                        itemId: text(line, "itemId"),
                        counted: count(line, "counted"),
                    })),
                },
            }
        case "transfer-stock":
            return {
                kind,
                params: {
                    itemId: text(fields, "itemId"),
                    fromLocationId: text(fields, "fromLocationId"),
                    toLocationId: text(fields, "toLocationId"),
                    qty: count(fields, "qty"),
                    note: text(fields, "note"),
                },
            }
        case "draft-low-stock":
            return { kind }
        case "create-po":
            return {
                kind,
                params: {
                    supplierId: text(fields, "supplierId"),
                    expectedAt: text(fields, "expectedAt"),
                    lines: rows(fields, "lines").map((line) => ({
                        itemId: text(line, "itemId"),
                        qty: text(line, "qty"),
                        unitCost: text(line, "unitCost"),
                    })),
                },
            }
        case "update-po-draft":
            return {
                kind,
                params: {
                    poId: text(fields, "poId"),
                    supplierId: text(fields, "supplierId"),
                    expectedAt: text(fields, "expectedAt"),
                    lines: decodeLines(fields),
                },
            }
        case "request-send":
            return {
                kind,
                params: { poId: text(fields, "poId"), kind: fields.kind === "reminder" ? "reminder" : "order" },
            }
        case "cancel-po":
            return { kind, params: { poId: text(fields, "poId") } }
        case "receive-po":
            return {
                kind,
                params: {
                    poId: text(fields, "poId"),
                    invoiceNo: text(fields, "invoiceNo"),
                    note: text(fields, "note"),
                    lines: decodeLines(fields),
                },
            }
        default:
            return null
    }
}
