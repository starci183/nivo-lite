/** The plain-language sentences the owner reads when an API or its spec cannot be used. */
export const OPENAPI_TEXT = {
    notJson: "API không trả về JSON, nên NIVO chưa đọc được dữ liệu.",
    notSpec: "Đây không phải đặc tả OpenAPI 3.x hoặc Swagger 2.0.",
    noOperations: "Đặc tả này không có API nào.",
    emptySpec: "Chưa có nội dung đặc tả.",
    unreadableSpec: "Không đọc được đặc tả: cần JSON hoặc YAML hợp lệ.",
    badSpecLink: "Link đặc tả không hợp lệ.",
    httpsSpecLink: "Link đặc tả phải bắt đầu bằng https://.",
    baseUrlScheme: "Địa chỉ gốc (base URL) phải bắt đầu bằng https://.",
} as const

/** The sentence for a spec link that did not answer with a spec. */
export const specDownloadFailure = (status: number): string =>
    `Không tải được đặc tả (lỗi ${status}). Kiểm tra lại link.`

/** The sentence for a path parameter the call has no value for. */
export const missingPathParam = (name: string): string => `Thiếu tham số đường dẫn ${name}.`

/** The sentence for a non-2xx status. */
export const openApiFailure = (status: number): string => {
    if (status === 401 || status === 403) return `API trả về lỗi ${status}: kiểm tra lại khoá API hoặc quyền truy cập.`
    if (status === 404) return "API trả về lỗi 404: kiểm tra lại địa chỉ gốc (base URL) và đường dẫn."
    if (status === 429) return "API trả về lỗi 429: bị giới hạn số lần gọi, hãy thử lại sau."
    return `API trả về lỗi ${status}.`
}
