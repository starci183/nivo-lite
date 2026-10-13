/** The plain-language sentences the owner reads in the API wizard and the API sync. */
export const OPENAPI_WIZARD_TEXT = {
    noSpecInput: "Nhập link đặc tả hoặc dán nội dung đặc tả.",
    specTooLarge: "Đặc tả quá lớn (hơn 5 MB).",
    getOnly: "Chỉ thử được API GET.",
    notConfigured: "Kết nối này chưa có cấu hình.",
    nameRequired: "Nhập tên cho kết nối.",
    badSchedule: "Chu kỳ đồng bộ không hợp lệ.",
    baseUrlScheme: "Địa chỉ gốc (base URL) phải bắt đầu bằng https://.",
    pickOne: "Chọn ít nhất một API để kéo dữ liệu hoặc cho agent dùng.",
    authRequired: "Nhập thông tin xác thực cho API.",
    authNameRequired: "Nhập tên header hoặc tham số của khoá API.",
    syncNotConfigured: "Cấu hình kết nối chưa đầy đủ: mở kết nối và lưu lại.",
    syncNoPulls: "Chưa chọn API nào để kéo dữ liệu định kỳ.",
    syncUnfinished: "Hết thời gian cho lần đồng bộ này, lần sau sẽ kéo tiếp.",
} as const

/** The line shown on the connection card. */
export const apiSummary = (pulls: number, tools: number): string => `${pulls} API kéo dữ liệu · ${tools} API cho agent`
