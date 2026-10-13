/** The sentences the owner reads when the database cannot be reached or read (Vietnamese; they travel as the `detail` of a rejection). */
export const DATABASE_COPY = {
    /** The user name or the password is wrong. */
    badLogin: "Sai mật khẩu hoặc người dùng.",
    /** The database does not exist on the server. */
    unknownDatabase: "Không tìm thấy cơ sở dữ liệu này trên máy chủ.",
    /** A statement ran longer than the limit. */
    queryTooSlow: "Câu truy vấn chạy quá 15 giây; hãy chọn ít cột hơn hoặc thêm cột cập nhật lúc.",
    /** The server did not answer in time. */
    connectTimeout: "Không kết nối được tới máy chủ trong 10 giây.",
    /** The server refused the connection. */
    refused: "Máy chủ từ chối kết nối; kiểm tra cổng và tường lửa.",
    /** The host name does not resolve. */
    unknownHost: "Không tìm thấy máy chủ.",
    /** The server closed the connection. */
    reset: "Máy chủ ngắt kết nối giữa chừng.",
    /** The server does not take encrypted connections. */
    noSsl: "Máy chủ không chấp nhận kết nối mã hóa SSL; thử tắt SSL hoặc kiểm tra cấu hình máy chủ.",
    /** The user may not read the table. */
    noPermission: "Người dùng không có quyền đọc bảng này.",
    /** The table is gone. */
    tableGone: "Bảng không còn tồn tại.",
    /** A picked column is gone. */
    columnGone: "Một cột đã chọn không còn tồn tại.",
    /** Anything else, with the driver message already shortened. */
    unreadable: (reason: string): string => `Không đọc được cơ sở dữ liệu: ${reason}`,
    /** A table or column name that cannot be quoted. */
    badName: "Tên cột hoặc bảng không hợp lệ.",
    /** A binary cell, shown instead of its bytes. */
    binary: (bytes: number): string => `[nhị phân ${bytes} byte]`,
} as const
