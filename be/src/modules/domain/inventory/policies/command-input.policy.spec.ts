import { mock } from "@starci/jest-preset"
import { decodeCommand } from "./command-input.policy"

const invalidFields = {
    id: 7,
    sku: false,
    name: 7,
    unit: null,
    units: 7,
    category: false,
    cost: 7,
    sell: null,
    reorderPoint: null,
    reorderQty: false,
    supplierId: 7,
    aliases: false,
    openingQty: 7,
    active: "true",
    contactName: 7,
    email: null,
    phone: false,
    zalo: 7,
    channel: false,
    leadTime: 7,
    terms: null,
    note: 7,
    lines: false,
    raw: 7,
    suppliers: false,
    items: 7,
    recipes: null,
    itemId: 7,
    locationId: false,
    delta: "2",
    counted: null,
    reason: false,
    counts: 7,
    fromLocationId: false,
    toLocationId: 7,
    qty: "2",
    expectedAt: 7,
    poId: false,
    kind: 7,
    invoiceNo: false,
}

describe("decodeCommand", () => {
    it.each([
        {
            kind: "save-item",
            params: {
                id: "item-1",
                sku: "TEA",
                name: "Tea",
                unit: "kg",
                units: "bag:25",
                category: "Dry",
                cost: "100",
                sell: "150",
                reorderPoint: "2",
                reorderQty: "5",
                supplierId: "supplier-1",
                aliases: "Green tea",
                openingQty: "10",
            },
        },
        {
            kind: "set-item-active",
            params: { id: "item-1", active: true },
        },
        {
            kind: "save-supplier",
            params: {
                id: "supplier-1",
                name: "Fresh Ltd",
                contactName: "Lan",
                email: "lan@example.com",
                phone: "123",
                zalo: "456",
                channel: "email",
                leadTime: "3",
                terms: "7 days",
                note: "Morning delivery",
            },
        },
        {
            kind: "save-recipe",
            params: { id: "recipe-1", name: "Tea cup", aliases: "Tea", lines: [{ itemId: "item-1", qty: "2" }] },
        },
        {
            kind: "delete-recipe",
            params: { id: "recipe-1" },
        },
        {
            kind: "save-location",
            params: { id: "location-1", name: "Pantry" },
        },
        {
            kind: "import-paste",
            params: { raw: "SKU,Name\nTEA,Tea" },
        },
        {
            kind: "apply-starter",
            params: {
                name: "Cafe",
                suppliers: [
                    {
                        name: "Fresh Ltd",
                        contactName: "Lan",
                        email: "lan@example.com",
                        phone: "123",
                        zalo: "456",
                        channel: "email",
                        leadTimeDays: 3,
                        paymentTerms: "7 days",
                    },
                ],
                items: [
                    {
                        sku: "TEA",
                        name: "Tea",
                        unit: "kg",
                        units: [{ unit: "bag", factor: 25 }],
                        category: "Dry",
                        costVnd: 100,
                        sellPriceVnd: 150,
                        reorderPoint: 2,
                        reorderQty: 5,
                        supplier: "Fresh Ltd",
                        aliases: ["Green tea"],
                        qty: 10,
                    },
                ],
                recipes: [{ name: "Tea cup", aliases: ["Tea"], lines: [{ sku: "TEA", qty: 2 }] }],
            },
        },
        {
            kind: "adjust-stock",
            params: { itemId: "item-1", locationId: "location-1", delta: -2, counted: 3, reason: "Count" },
        },
        {
            kind: "stock-take",
            params: { counts: [{ itemId: "item-1", counted: 3 }] },
        },
        {
            kind: "transfer-stock",
            params: {
                itemId: "item-1",
                fromLocationId: "location-1",
                toLocationId: "location-2",
                qty: 2,
                note: "Restock",
            },
        },
        {
            kind: "create-po",
            params: {
                supplierId: "supplier-1",
                expectedAt: "2026-10-20",
                lines: [{ itemId: "item-1", qty: "2", unitCost: "100" }],
            },
        },
        {
            kind: "update-po-draft",
            params: {
                poId: "po-1",
                supplierId: "supplier-1",
                expectedAt: "2026-10-20",
                lines: [{ lineId: "line-1", qty: "2", unitCost: "100" }],
            },
        },
        {
            kind: "request-send",
            params: { poId: "po-1", kind: "reminder" },
        },
        {
            kind: "cancel-po",
            params: { poId: "po-1" },
        },
        {
            kind: "receive-po",
            params: {
                poId: "po-1",
                invoiceNo: "INV-1",
                note: "Delivered",
                lines: [{ lineId: "line-1", qty: "2", unitCost: "100" }],
            },
        },
    ])("decodes every field of a full $kind input", ({ kind, params }) => {
        expect(decodeCommand(kind, { ...params, ignored: "value" })).toStrictEqual({ kind, params })
    })

    it("decodes a full low-stock draft without params", () => {
        expect(decodeCommand("draft-low-stock", { itemId: "item-1", ignored: "value" })).toStrictEqual({
            kind: "draft-low-stock",
        })
    })

    it.each([
        {
            kind: "save-item",
            expected: {
                kind: "save-item",
                params: {
                    sku: "",
                    name: "",
                    unit: "",
                    units: "",
                    category: "",
                    cost: "",
                    sell: "",
                    reorderPoint: "",
                    reorderQty: "",
                    supplierId: "",
                    aliases: "",
                },
            },
        },
        { kind: "set-item-active", expected: { kind: "set-item-active", params: { id: "", active: false } } },
        {
            kind: "save-supplier",
            expected: {
                kind: "save-supplier",
                params: {
                    name: "",
                    contactName: "",
                    email: "",
                    phone: "",
                    zalo: "",
                    channel: "",
                    leadTime: "",
                    terms: "",
                    note: "",
                },
            },
        },
        {
            kind: "save-recipe",
            expected: { kind: "save-recipe", params: { name: "", aliases: "", lines: [] } },
        },
        { kind: "delete-recipe", expected: { kind: "delete-recipe", params: { id: "" } } },
        { kind: "save-location", expected: { kind: "save-location", params: { name: "" } } },
        { kind: "import-paste", expected: { kind: "import-paste", params: { raw: "" } } },
        {
            kind: "apply-starter",
            expected: { kind: "apply-starter", params: { name: "", suppliers: [], items: [], recipes: [] } },
        },
        { kind: "adjust-stock", expected: { kind: "adjust-stock", params: { itemId: "", reason: "" } } },
        { kind: "stock-take", expected: { kind: "stock-take", params: { counts: [] } } },
        {
            kind: "transfer-stock",
            expected: {
                kind: "transfer-stock",
                params: { itemId: "", fromLocationId: "", toLocationId: "", qty: 0, note: "" },
            },
        },
        { kind: "draft-low-stock", expected: { kind: "draft-low-stock" } },
        {
            kind: "create-po",
            expected: { kind: "create-po", params: { supplierId: "", expectedAt: "", lines: [] } },
        },
        {
            kind: "update-po-draft",
            expected: { kind: "update-po-draft", params: { poId: "", supplierId: "", expectedAt: "", lines: [] } },
        },
        { kind: "request-send", expected: { kind: "request-send", params: { poId: "", kind: "order" } } },
        { kind: "cancel-po", expected: { kind: "cancel-po", params: { poId: "" } } },
        {
            kind: "receive-po",
            expected: { kind: "receive-po", params: { poId: "", invoiceNo: "", note: "", lines: [] } },
        },
    ])("defaults missing and wrong-typed $kind fields and omits absent optional fields", ({ kind, expected }) => {
        expect(decodeCommand(kind, {})).toStrictEqual(expected)
        expect(decodeCommand(kind, invalidFields)).toStrictEqual(expected)
    })

    it.each([{ input: undefined }, { input: null }, { input: [] }, { input: "invalid" }, { input: 7 }])(
        "treats a non-object input as empty fields: $input",
        ({ input }) => {
            expect(decodeCommand("delete-recipe", input)).toStrictEqual({ kind: "delete-recipe", params: { id: "" } })
        },
    )

    it("returns null for an unknown command kind", () => {
        expect(decodeCommand("unknown", { id: "item-1" })).toBeNull()
    })

    it("keeps only string aliases in starter lists", () => {
        expect(decodeCommand("apply-starter", { recipes: [{ aliases: [7, "Tea", null, false] }] })).toStrictEqual({
            kind: "apply-starter",
            params: {
                name: "",
                suppliers: [],
                items: [],
                recipes: [{ name: "", aliases: ["Tea"], lines: [] }],
            },
        })
    })

    it("uses the guarded alias helper's empty fallback when the array guard changes", () => {
        const aliases = ["Tea"]
        const isArray = Array.isArray
        const arrays = mock<ArrayConstructor>()
        let aliasChecks = 0
        arrays.isArray.mockImplementation((value): value is Array<unknown> => {
            if (value === aliases) {
                aliasChecks += 1
                return aliasChecks === 1
            }
            return isArray(value)
        })
        const decoded = (() => {
            Array.isArray = arrays.isArray
            try {
                return decodeCommand("apply-starter", { recipes: [{ name: "Tea cup", aliases }] })
            } finally {
                Array.isArray = isArray
            }
        })()

        expect(decoded).toStrictEqual({
            kind: "apply-starter",
            params: { name: "", suppliers: [], items: [], recipes: [{ name: "Tea cup", aliases: [], lines: [] }] },
        })
    })

    it("keeps empty strings and zero values when optional fields are supplied", () => {
        expect(decodeCommand("adjust-stock", { itemId: "item-1", locationId: "", delta: 0, counted: 0 })).toStrictEqual(
            {
                kind: "adjust-stock",
                params: { itemId: "item-1", locationId: "", delta: 0, counted: 0, reason: "" },
            },
        )
        expect(decodeCommand("save-location", { id: "", name: "Pantry" })).toStrictEqual({
            kind: "save-location",
            params: { id: "", name: "Pantry" },
        })
    })

    it("omits non-finite optional numbers", () => {
        expect(decodeCommand("adjust-stock", { itemId: "item-1", delta: Number.NaN, counted: Infinity })).toStrictEqual(
            {
                kind: "adjust-stock",
                params: { itemId: "item-1", reason: "" },
            },
        )
    })

    it("defaults malformed nested starter fields and leaves out optional fields", () => {
        expect(
            decodeCommand("apply-starter", {
                name: 7,
                suppliers: [{ name: false, channel: null, leadTimeDays: Infinity }, null],
                items: [
                    {
                        sku: false,
                        name: null,
                        unit: 7,
                        units: [{ unit: 7, factor: Number.NaN }, []],
                        category: false,
                        costVnd: Infinity,
                        sellPriceVnd: Number.NaN,
                        reorderPoint: "2",
                        reorderQty: null,
                        supplier: 7,
                        aliases: false,
                        qty: -Infinity,
                    },
                    "invalid",
                ],
                recipes: [{ name: 7, aliases: false, lines: [{ sku: 7, qty: "2" }, undefined] }],
            }),
        ).toStrictEqual({
            kind: "apply-starter",
            params: {
                name: "",
                suppliers: [
                    { name: "", channel: "", leadTimeDays: 0 },
                    { name: "", channel: "", leadTimeDays: 0 },
                ],
                items: [
                    {
                        sku: "",
                        name: "",
                        unit: "",
                        units: [
                            { unit: "", factor: 0 },
                            { unit: "", factor: 0 },
                        ],
                        category: "",
                        costVnd: 0,
                        reorderPoint: 0,
                        reorderQty: 0,
                        qty: 0,
                    },
                    { sku: "", name: "", unit: "", category: "", costVnd: 0, reorderPoint: 0, reorderQty: 0, qty: 0 },
                ],
                recipes: [
                    {
                        name: "",
                        lines: [
                            { sku: "", qty: 0 },
                            { sku: "", qty: 0 },
                        ],
                    },
                ],
            },
        })
    })

    it.each([
        {
            kind: "save-recipe",
            expected: {
                kind: "save-recipe",
                params: { name: "", aliases: "", lines: [{ itemId: "", qty: "" }] },
            },
        },
        {
            kind: "create-po",
            expected: {
                kind: "create-po",
                params: { supplierId: "", expectedAt: "", lines: [{ itemId: "", qty: "", unitCost: "" }] },
            },
        },
        {
            kind: "update-po-draft",
            expected: {
                kind: "update-po-draft",
                params: { poId: "", supplierId: "", expectedAt: "", lines: [{ lineId: "", qty: "", unitCost: "" }] },
            },
        },
        {
            kind: "receive-po",
            expected: {
                kind: "receive-po",
                params: { poId: "", invoiceNo: "", note: "", lines: [{ lineId: "", qty: "", unitCost: "" }] },
            },
        },
    ])("defaults wrong-typed fields in $kind lines", ({ kind, expected }) => {
        expect(decodeCommand(kind, { lines: [{ itemId: 7, lineId: false, qty: 7, unitCost: null }] })).toStrictEqual(
            expected,
        )
    })

    it("defaults malformed count rows and non-finite counts to zero", () => {
        expect(
            decodeCommand("stock-take", {
                counts: [{ itemId: "item-1", counted: Infinity }, { itemId: 7, counted: "2" }, null],
            }),
        ).toStrictEqual({
            kind: "stock-take",
            params: {
                counts: [
                    { itemId: "item-1", counted: 0 },
                    { itemId: "", counted: 0 },
                    { itemId: "", counted: 0 },
                ],
            },
        })
    })

    it("decodes an order send request", () => {
        expect(decodeCommand("request-send", { poId: "po-1", kind: "order" })).toStrictEqual({
            kind: "request-send",
            params: { poId: "po-1", kind: "order" },
        })
    })
})
