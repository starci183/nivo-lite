/** The sentences the owner reads in the database wizard and in a database sync (Vietnamese; they travel as the `detail` of a refusal). */
export const DATABASE_WIZARD_COPY = {
    /** The stored credential cannot be read. */
    brokenCredential: "Thông tin kết nối đã lưu bị hỏng; hãy mở lại và nhập lại mật khẩu.",
    /** The stored credential has no host, database or user. */
    incompleteCredential: "Thông tin kết nối chưa đầy đủ.",
    /** The engine is not one of the three. */
    badEngine: "Loại cơ sở dữ liệu không hợp lệ.",
    /** No host typed. */
    needHost: "Nhập địa chỉ máy chủ.",
    /** The port is out of range. */
    badPort: "Cổng phải từ 1 đến 65535.",
    /** No database name typed. */
    needDatabase: "Nhập tên cơ sở dữ liệu.",
    /** No user typed. */
    needUser: "Nhập tên người dùng.",
    /** The password is too long. */
    passwordTooLong: "Mật khẩu quá dài.",
    /** A table without an id column. */
    needIdColumn: (table: string): string => `Bảng ${table} cần một cột mã.`,
    /** A table without a name. */
    unnamedTable: "(chưa đặt tên)",
    /** The same table picked twice. */
    pickedTwice: (key: string): string => `Bảng ${key} bị chọn hai lần.`,
    /** No table picked. */
    needTable: "Chọn ít nhất một bảng.",
    /** Too many tables. */
    tooManyTables: "Tối đa 100 bảng cho mỗi kết nối.",
    /** The saved mapping is missing or broken. */
    brokenConfig: "Chưa chọn bảng nào để đồng bộ, hoặc cấu hình bảng bị hỏng; hãy mở lại kết nối và lưu lại.",
    /** The connection works but shows nothing. */
    noTables: "Kết nối được nhưng người dùng này không thấy bảng nào; cấp quyền SELECT cho người dùng.",
    /** The connection needs a name. */
    needName: "Đặt tên cho kết nối.",
    /** The schedule is not one of the offered ones. */
    badSchedule: "Chu kỳ đồng bộ không hợp lệ.",
    /** A password is needed. */
    needPassword: "Nhập mật khẩu của người dùng này.",
    /** The saved connection cannot be reopened. */
    brokenSaved: "Thông tin kết nối đã lưu bị hỏng; hãy nhập lại.",
    /** The product name of the engine with the number of tables. */
    summary: (engine: string, tables: number): string => `${engine} · ${tables} bảng`,
} as const
