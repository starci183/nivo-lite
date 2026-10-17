import type { InventoryTemplate } from "../inventory.templates"

/** The starter's treatment items. */
const treatmentItems = (): InventoryTemplate["starter"]["items"] => [
    {
        sku: "TINH-DAU",
        name: "Tinh dầu massage",
        unit: "ml",
        units: [
            {
                unit: "chai",
                factor: 500,
            },
        ],
        category: "Vật tư liệu trình",
        costVnd: 900,
        reorderPoint: 500,
        reorderQty: 2000,
        supplier: "Mỹ phẩm & vật tư spa Ánh Dương",
        qty: 2000,
    },
    {
        sku: "MAT-NA",
        name: "Mặt nạ dưỡng da",
        unit: "miếng",
        units: [
            {
                unit: "hộp",
                factor: 10,
            },
        ],
        category: "Vật tư liệu trình",
        costVnd: 14000,
        reorderPoint: 20,
        reorderQty: 100,
        supplier: "Mỹ phẩm & vật tư spa Ánh Dương",
        qty: 60,
    },
]

/** The starter's disposable items. */
const disposableItems = (): InventoryTemplate["starter"]["items"] => [
    {
        sku: "BONG-TRANG",
        name: "Bông tẩy trang",
        unit: "miếng",
        units: [
            {
                unit: "gói",
                factor: 200,
            },
        ],
        category: "Vật tư dùng một lần",
        costVnd: 350,
        reorderPoint: 200,
        reorderQty: 1000,
        supplier: "Công ty vật tư y tế An Phúc",
        qty: 600,
    },
    {
        sku: "GANG-TAY",
        name: "Găng tay y tế",
        unit: "đôi",
        units: [
            {
                unit: "hộp",
                factor: 50,
            },
        ],
        category: "Vật tư dùng một lần",
        costVnd: 1500,
        reorderPoint: 50,
        reorderQty: 200,
        supplier: "Công ty vật tư y tế An Phúc",
        qty: 120,
    },
]

/** The starter's linen and cosmetic items. */
const linenAndCosmeticItems = (): InventoryTemplate["starter"]["items"] => [
    {
        sku: "KHAN-SPA",
        name: "Khăn spa",
        unit: "cái",
        category: "Đồ vải",
        costVnd: 25000,
        reorderPoint: 20,
        reorderQty: 40,
        supplier: "Mỹ phẩm & vật tư spa Ánh Dương",
        qty: 50,
    },
    {
        sku: "SERUM",
        name: "Serum phục hồi",
        unit: "ml",
        units: [
            {
                unit: "chai",
                factor: 30,
            },
        ],
        category: "Mỹ phẩm",
        costVnd: 3500,
        reorderPoint: 100,
        reorderQty: 600,
        supplier: "Mỹ phẩm & vật tư spa Ánh Dương",
        qty: 300,
    },
]

/** The starter's hygiene items. */
const hygieneItems = (): InventoryTemplate["starter"]["items"] => [
    {
        sku: "GIAY-GIUONG",
        name: "Giấy trải giường",
        unit: "cuộn",
        category: "Vật tư dùng một lần",
        costVnd: 45000,
        reorderPoint: 5,
        reorderQty: 20,
        supplier: "Công ty vật tư y tế An Phúc",
        qty: 12,
    },
    {
        sku: "CON-SAT",
        name: "Cồn sát khuẩn",
        unit: "ml",
        units: [
            {
                unit: "chai",
                factor: 500,
            },
        ],
        category: "Vật tư dùng một lần",
        costVnd: 80,
        reorderPoint: 1000,
        reorderQty: 5000,
        supplier: "Công ty vật tư y tế An Phúc",
        qty: 3000,
    },
]

/** Spa & thẩm mỹ */
export const spaTemplate = (): InventoryTemplate => ({
    key: "spa",
    name: "Spa & thẩm mỹ",
    description:
        "Vật tư dùng cho liệu trình (tinh dầu, mặt nạ, bông, găng tay); " +
        "công thức liệu trình tự trừ vật tư khi hoàn tất đơn.",
    starter: {
        name: "Spa & thẩm mỹ",
        suppliers: [
            {
                name: "Mỹ phẩm & vật tư spa Ánh Dương",
                contactName: "chị Dương",
                channel: "zalo",
                leadTimeDays: 2,
            },
            {
                name: "Công ty vật tư y tế An Phúc",
                contactName: "chị Phúc",
                channel: "email",
                leadTimeDays: 3,
                paymentTerms: "Thanh toán trước",
            },
        ],
        items: [...treatmentItems(), ...disposableItems(), ...linenAndCosmeticItems(), ...hygieneItems()],
        recipes: [
            {
                name: "Chăm sóc da cơ bản",
                aliases: ["cham soc da", "facial"],
                lines: [
                    {
                        sku: "MAT-NA",
                        qty: 1,
                    },
                    {
                        sku: "TINH-DAU",
                        qty: 10,
                    },
                    {
                        sku: "BONG-TRANG",
                        qty: 6,
                    },
                    {
                        sku: "GANG-TAY",
                        qty: 1,
                    },
                    {
                        sku: "SERUM",
                        qty: 3,
                    },
                ],
            },
        ],
    },
})
