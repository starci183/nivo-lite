import type { InventoryTemplate } from "../inventory.templates"

/** The starter's beverage items. */
const beverageItems = (): InventoryTemplate["starter"]["items"] => [
    {
        sku: "NUOC-SUOI",
        name: "Nước suối 500ml",
        unit: "chai",
        units: [
            {
                unit: "thùng",
                factor: 24,
            },
        ],
        category: "Đồ uống",
        costVnd: 3500,
        sellPriceVnd: 6000,
        reorderPoint: 48,
        reorderQty: 240,
        supplier: "Đại lý nước giải khát Bình An",
        aliases: ["nước suối", "aquafina"],
        qty: 120,
    },
    {
        sku: "NUOC-NGOT",
        name: "Nước ngọt lon",
        unit: "lon",
        units: [
            {
                unit: "thùng",
                factor: 24,
            },
        ],
        category: "Đồ uống",
        costVnd: 7500,
        sellPriceVnd: 12000,
        reorderPoint: 48,
        reorderQty: 240,
        supplier: "Đại lý nước giải khát Bình An",
        qty: 96,
    },
]

/** The starter's food items. */
const foodItems = (): InventoryTemplate["starter"]["items"] => [
    {
        sku: "MI-GOI",
        name: "Mì gói",
        unit: "gói",
        units: [
            {
                unit: "thùng",
                factor: 30,
            },
        ],
        category: "Thực phẩm",
        costVnd: 3200,
        sellPriceVnd: 5000,
        reorderPoint: 60,
        reorderQty: 300,
        supplier: "Tổng kho hàng tiêu dùng Việt Phát",
        aliases: ["mì tôm"],
        qty: 150,
    },
    {
        sku: "DAU-AN",
        name: "Dầu ăn 1 lít",
        unit: "chai",
        category: "Thực phẩm",
        costVnd: 42000,
        sellPriceVnd: 55000,
        reorderPoint: 10,
        reorderQty: 24,
        supplier: "Tổng kho hàng tiêu dùng Việt Phát",
        qty: 30,
    },
    {
        sku: "GAO",
        name: "Gạo thơm",
        unit: "kg",
        units: [
            {
                unit: "bao",
                factor: 25,
            },
        ],
        category: "Thực phẩm",
        costVnd: 17000,
        sellPriceVnd: 22000,
        reorderPoint: 50,
        reorderQty: 200,
        supplier: "Tổng kho hàng tiêu dùng Việt Phát",
        qty: 120,
    },
]

/** The starter's household and snack items. */
const householdAndSnackItems = (): InventoryTemplate["starter"]["items"] => [
    {
        sku: "KHAN-GIAY",
        name: "Khăn giấy",
        unit: "gói",
        category: "Gia dụng",
        costVnd: 6000,
        sellPriceVnd: 9000,
        reorderPoint: 20,
        reorderQty: 100,
        supplier: "Tổng kho hàng tiêu dùng Việt Phát",
        qty: 60,
    },
    {
        sku: "BANH-QUY",
        name: "Bánh quy hộp",
        unit: "hộp",
        category: "Bánh kẹo",
        costVnd: 28000,
        sellPriceVnd: 38000,
        reorderPoint: 10,
        reorderQty: 40,
        supplier: "Tổng kho hàng tiêu dùng Việt Phát",
        qty: 25,
    },
    {
        sku: "BOT-GIAT",
        name: "Bột giặt túi 3kg",
        unit: "túi",
        category: "Gia dụng",
        costVnd: 85000,
        sellPriceVnd: 110000,
        reorderPoint: 6,
        reorderQty: 24,
        supplier: "Tổng kho hàng tiêu dùng Việt Phát",
        qty: 14,
    },
]

/** Cửa hàng bán lẻ / tạp hoá */
export const retailTemplate = (): InventoryTemplate => ({
    key: "retail",
    name: "Cửa hàng bán lẻ / tạp hoá",
    description: "Hàng tiêu dùng bán nguyên món; mỗi lần bán trừ thẳng số lượng, nhập theo thùng.",
    starter: {
        name: "Cửa hàng bán lẻ / tạp hoá",
        suppliers: [
            {
                name: "Đại lý nước giải khát Bình An",
                contactName: "chị Bình",
                channel: "zalo",
                leadTimeDays: 1,
            },
            {
                name: "Tổng kho hàng tiêu dùng Việt Phát",
                contactName: "anh Phát",
                channel: "email",
                leadTimeDays: 3,
                paymentTerms: "Công nợ 15 ngày",
            },
        ],
        items: [...beverageItems(), ...foodItems(), ...householdAndSnackItems()],
        recipes: [],
    },
})
