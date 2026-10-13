import type { MessageBundle } from "@modules/platform/i18n"

/** Display text of the orders codes, Vietnamese and English. */
export const ORDERS_MESSAGES: MessageBundle = {
    vi: {
        "errors.ORDERS_SHIPMENT_INVALID": "Nhập đơn vị vận chuyển và mã vận đơn hợp lệ.",
        "errors.ORDERS_NOT_SHIPPABLE": "Đơn hàng không thể giao hoặc đã được giao.",
        "errors.ORDERS_NOT_CONFIRMED": "Đơn hàng chưa được xác nhận.",
        "errors.ORDERS_ALREADY_INVOICED": "Đơn hàng đã có hóa đơn.",
        "sales.shipped": "{{who}} đã giao đơn {{no}} cho {{carrier}}.",
        "errors.ORDERS_NOT_NUMBERED": "Không tạo được mã đơn hàng.",
    },
    en: {
        "errors.ORDERS_SHIPMENT_INVALID": "Enter a valid carrier and tracking code.",
        "errors.ORDERS_NOT_SHIPPABLE": "The order cannot be shipped or has already been shipped.",
        "errors.ORDERS_NOT_CONFIRMED": "The order has not been confirmed.",
        "errors.ORDERS_ALREADY_INVOICED": "The order already has an invoice.",
        "sales.shipped": "{{who}} handed order {{no}} to {{carrier}}.",
        "errors.ORDERS_NOT_NUMBERED": "The order number could not be created.",
    },
}
