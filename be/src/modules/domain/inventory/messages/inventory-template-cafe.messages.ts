import type { InventoryTemplate } from "../inventory-templates"

/** Quán cà phê & trà */
export const CAFE_TEMPLATE: InventoryTemplate = {
    key: "cafe",
    name: "Quán cà phê & trà",
    description:
        "Nguyên liệu pha chế (cà phê, sữa, đường), ly, ống hút; 1 công thức cà phê sữa tự trừ nguyên liệu khi bán.",
    starter: {
        name: "Quán cà phê & trà",
        suppliers: [
            {
                name: "Cà phê Tây Nguyên Phú Lộc",
                contactName: "chị Hương",
                channel: "email",
                leadTimeDays: 2,
                paymentTerms: "Thanh toán khi nhận hàng",
            },
            {
                name: "Tạp hoá sỉ Minh Anh",
                contactName: "anh Minh",
                channel: "zalo",
                leadTimeDays: 1,
                paymentTerms: "Công nợ 7 ngày",
            },
        ],
        items: [
            {
                sku: "CF-HAT",
                name: "Cà phê hạt rang",
                unit: "g",
                units: [
                    {
                        unit: "kg",
                        factor: 1000,
                    },
                ],
                category: "Nguyên liệu",
                costVnd: 250,
                reorderPoint: 2000,
                reorderQty: 10000,
                supplier: "Cà phê Tây Nguyên Phú Lộc",
                aliases: ["cà phê hạt", "ca phe hat"],
                qty: 6000,
            },
            {
                sku: "SUA-DAC",
                name: "Sữa đặc",
                unit: "ml",
                units: [
                    {
                        unit: "hộp",
                        factor: 380,
                    },
                ],
                category: "Nguyên liệu",
                costVnd: 60,
                reorderPoint: 1500,
                reorderQty: 7600,
                supplier: "Tạp hoá sỉ Minh Anh",
                aliases: ["sữa đặc có đường"],
                qty: 4000,
            },
            {
                sku: "SUA-TUOI",
                name: "Sữa tươi",
                unit: "ml",
                units: [
                    {
                        unit: "lít",
                        factor: 1000,
                    },
                    {
                        unit: "thùng",
                        factor: 12000,
                    },
                ],
                category: "Nguyên liệu",
                costVnd: 30,
                reorderPoint: 3000,
                reorderQty: 12000,
                supplier: "Tạp hoá sỉ Minh Anh",
                qty: 8000,
            },
            {
                sku: "DUONG",
                name: "Đường cát",
                unit: "g",
                units: [
                    {
                        unit: "kg",
                        factor: 1000,
                    },
                ],
                category: "Nguyên liệu",
                costVnd: 22,
                reorderPoint: 2000,
                reorderQty: 10000,
                supplier: "Tạp hoá sỉ Minh Anh",
                qty: 7000,
            },
            {
                sku: "TRA-DEN",
                name: "Trà đen",
                unit: "g",
                units: [
                    {
                        unit: "kg",
                        factor: 1000,
                    },
                ],
                category: "Nguyên liệu",
                costVnd: 180,
                reorderPoint: 1000,
                reorderQty: 5000,
                supplier: "Cà phê Tây Nguyên Phú Lộc",
                qty: 3000,
            },
            {
                sku: "LY-NHUA",
                name: "Ly nhựa 500ml",
                unit: "cái",
                units: [
                    {
                        unit: "cây",
                        factor: 50,
                    },
                ],
                category: "Bao bì",
                costVnd: 900,
                reorderPoint: 200,
                reorderQty: 1000,
                supplier: "Tạp hoá sỉ Minh Anh",
                qty: 600,
            },
            {
                sku: "NAP-LY",
                name: "Nắp ly",
                unit: "cái",
                units: [
                    {
                        unit: "cây",
                        factor: 100,
                    },
                ],
                category: "Bao bì",
                costVnd: 300,
                reorderPoint: 200,
                reorderQty: 1000,
                supplier: "Tạp hoá sỉ Minh Anh",
                qty: 600,
            },
            {
                sku: "ONG-HUT",
                name: "Ống hút",
                unit: "cái",
                units: [
                    {
                        unit: "hộp",
                        factor: 100,
                    },
                ],
                category: "Bao bì",
                costVnd: 150,
                reorderPoint: 200,
                reorderQty: 1000,
                supplier: "Tạp hoá sỉ Minh Anh",
                qty: 600,
            },
        ],
        recipes: [
            {
                name: "Cà phê sữa",
                aliases: ["ca phe sua", "cf sữa", "cafe sữa"],
                lines: [
                    {
                        sku: "CF-HAT",
                        qty: 20,
                    },
                    {
                        sku: "SUA-DAC",
                        qty: 30,
                    },
                    {
                        sku: "LY-NHUA",
                        qty: 1,
                    },
                    {
                        sku: "NAP-LY",
                        qty: 1,
                    },
                    {
                        sku: "ONG-HUT",
                        qty: 1,
                    },
                ],
            },
        ],
    },
}

