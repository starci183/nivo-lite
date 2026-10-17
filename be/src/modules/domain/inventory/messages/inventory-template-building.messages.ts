import type { InventoryTemplate } from "../inventory.templates"

/** The starter's masonry items. */
const masonryItems = (): InventoryTemplate["starter"]["items"] => [
    {
        sku: "XM-PCB40",
        name: "Xi măng PCB40",
        unit: "bao",
        units: [
            {
                unit: "tấn",
                factor: 20,
            },
        ],
        category: "Xi măng",
        costVnd: 86000,
        sellPriceVnd: 98000,
        reorderPoint: 100,
        reorderQty: 400,
        supplier: "Nhà máy xi măng & vật liệu Hoà Phát Miền Nam",
        aliases: ["xi măng", "xi mang"],
        qty: 300,
    },
    {
        sku: "GACH-ONG",
        name: "Gạch ống 8x8x18",
        unit: "viên",
        units: [
            {
                unit: "xe",
                factor: 3000,
            },
        ],
        category: "Gạch",
        costVnd: 1250,
        sellPriceVnd: 1600,
        reorderPoint: 3000,
        reorderQty: 9000,
        supplier: "Bãi cát đá Tân Uyên",
        aliases: ["gạch", "gạch ống"],
        qty: 8000,
    },
    {
        sku: "CAT-XAY",
        name: "Cát xây tô",
        unit: "m3",
        category: "Cát đá",
        costVnd: 220000,
        sellPriceVnd: 280000,
        reorderPoint: 10,
        reorderQty: 30,
        supplier: "Bãi cát đá Tân Uyên",
        qty: 25,
    },
    {
        sku: "DA-1X2",
        name: "Đá 1x2",
        unit: "m3",
        category: "Cát đá",
        costVnd: 260000,
        sellPriceVnd: 330000,
        reorderPoint: 10,
        reorderQty: 30,
        supplier: "Bãi cát đá Tân Uyên",
        qty: 22,
    },
]

/** The starter's finishing items. */
const finishingItems = (): InventoryTemplate["starter"]["items"] => [
    {
        sku: "THEP-D10",
        name: "Thép phi 10",
        unit: "cây",
        units: [
            {
                unit: "bó",
                factor: 10,
            },
        ],
        category: "Sắt thép",
        costVnd: 105000,
        sellPriceVnd: 125000,
        reorderPoint: 50,
        reorderQty: 200,
        supplier: "Nhà máy xi măng & vật liệu Hoà Phát Miền Nam",
        qty: 120,
    },
    {
        sku: "SON-NUOC",
        name: "Sơn nước nội thất 18 lít",
        unit: "thùng",
        category: "Sơn",
        costVnd: 1450000,
        sellPriceVnd: 1790000,
        reorderPoint: 5,
        reorderQty: 20,
        supplier: "Nhà máy xi măng & vật liệu Hoà Phát Miền Nam",
        qty: 12,
    },
]

/** The starter's utility items. */
const utilityItems = (): InventoryTemplate["starter"]["items"] => [
    {
        sku: "DAY-DIEN",
        name: "Dây điện 2.5mm (cuộn 100m)",
        unit: "cuộn",
        category: "Điện nước",
        costVnd: 780000,
        sellPriceVnd: 920000,
        reorderPoint: 4,
        reorderQty: 12,
        supplier: "Nhà máy xi măng & vật liệu Hoà Phát Miền Nam",
        qty: 9,
    },
    {
        sku: "ONG-PVC",
        name: "Ống nước PVC phi 21",
        unit: "cây",
        category: "Điện nước",
        costVnd: 28000,
        sellPriceVnd: 38000,
        reorderPoint: 40,
        reorderQty: 120,
        supplier: "Nhà máy xi măng & vật liệu Hoà Phát Miền Nam",
        qty: 90,
    },
]

/** Cửa hàng vật liệu xây dựng */
export const buildingTemplate = (): InventoryTemplate => ({
    key: "building",
    name: "Cửa hàng vật liệu xây dựng",
    description: "Xi măng, gạch, cát đá, thép, sơn, điện nước: bán theo đơn vị riêng, nhập theo xe hoặc theo bó.",
    starter: {
        name: "Cửa hàng vật liệu xây dựng",
        suppliers: [
            {
                name: "Nhà máy xi măng & vật liệu Hoà Phát Miền Nam",
                contactName: "anh Tuấn",
                channel: "email",
                leadTimeDays: 2,
                paymentTerms: "Công nợ 30 ngày",
            },
            {
                name: "Bãi cát đá Tân Uyên",
                contactName: "chú Sáu",
                channel: "phone",
                leadTimeDays: 1,
            },
        ],
        items: [...masonryItems(), ...finishingItems(), ...utilityItems()],
        recipes: [],
    },
})
