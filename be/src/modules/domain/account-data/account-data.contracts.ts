/** The type of one member of a stored value: what the engine's schema and the generated CHECK of the member hold it to. */
export type AccountFieldType = "text" | "integer" | "number" | "boolean" | "timestamp" | "json"

/** How rows of a type are written: insert once, upsert by key (latest wins), or one forward-only row per key. */
export type AccountWriteMode = "append" | "overwrite" | "advance"

/** One member of the value of a type. */
export interface AccountFieldDef {
    /** What the member holds; `timestamp` is ISO text with an offset, `json` any JSON value but null. */
    readonly type: AccountFieldType
    /** True when every value holds the member; an optional member is absent, never null. */
    readonly required: boolean
    /** The longest text a `text` member holds, in characters; only for `text`. */
    readonly maxLength?: number | undefined
}

/** One expression index of a type's partition: `(connection_id, value ->> field, ...)`. */
export interface AccountIndexDef {
    /** The index name inside the type, lower-case `[a-z][a-z0-9_]*`; the database name is `<partition>_<name>`. */
    readonly name: string
    /** One or two declared members, in index order. */
    readonly on: ReadonlyArray<string>
}

/** How long rows of a type are kept: days after they occurred (a `wakes` type: after they were processed), or for good. */
export type AccountRetention = { readonly days: number } | "keep"

/** The declaration of one account data type: the ONLY thing a provider adds to store its data. */
export interface AccountDataTypeDef {
    /** `<provider>.<name>`: `[a-z0-9_]+` "." `[a-z0-9-]+`, at most 50 characters, unique across the catalog. */
    readonly name: string
    /** The `connections.provider` that may write the type; null = any provider. */
    readonly provider: string | null
    /** The version of the fields; bumped when they change, old rows keep theirs. */
    readonly version: number
    /** How rows are written. */
    readonly write: AccountWriteMode
    /** The members of a value, exactly these (strict). */
    readonly fields: Readonly<Record<string, AccountFieldDef>>
    /** The members whose values, joined by ":", are the row key (the provider's own id); each a required text or integer member. */
    readonly key: ReadonlyArray<string>
    /** A `timestamp` member that says when the row happened; absent = when it was written. */
    readonly occurredAt?: string | undefined
    /** `advance` only: the required member that must grow (text by code unit, integer / number numerically). */
    readonly position?: string | undefined
    /** `overwrite` only: rows older than this, in milliseconds, read as absent and are swept. */
    readonly ttlMs?: number | undefined
    /** A value whose JSON text is longer than this, in bytes, is refused. */
    readonly maxBytes?: number | undefined
    /** `append` only: new rows are pending (processed_at null) until their consumer completes them. */
    readonly wakes?: boolean | undefined
    /** How long rows are kept; a `wakes` type never loses a pending row. */
    readonly retention: AccountRetention
    /** Expression indexes, at most 4 of at most 2 members each. */
    readonly indexes?: ReadonlyArray<AccountIndexDef> | undefined
    /** Member NAMES that never appear anywhere (at any depth) in a value of the type. */
    readonly secretFields?: ReadonlyArray<string> | undefined
    /** A tag for the purpose layer; never read by the engine. */
    readonly purpose?: string | undefined
}

/** The account a row belongs to: the connection, its provider and its workspace. */
export interface AccountOwner {
    /** The provider of the connection, as `connections.provider` names it (`zalo_oa`, `sepay`, ...). */
    readonly provider: string
    /** The connection. */
    readonly connectionId: string
    /** The workspace of the connection. */
    readonly workspaceId: string
}

/** One row a door or a consumer hands the intake: a declared type and its value. */
export interface AccountDataInput {
    /** The declared type. */
    readonly type: string
    /** The value, members exactly as the type declares them. */
    readonly value: object
}

/** One delivery of a provider, as a door hands it to the intake to be claimed once: the connection it arrived on and its one row. */
export interface AccountDelivery {
    /** The connection the delivery arrived on. */
    readonly connectionId: string
    /** The declared type of the delivery's row. */
    readonly type: string
    /** The value of the row, in the shape the type declares. */
    readonly value: object
}

/** The row a claim wrote; undefined when the delivery was received before or no account holds the connection. */
export type ClaimedDelivery = WrittenRow | undefined

/** What the intake did with one input. */
export interface WrittenRow {
    /** The type. */
    readonly type: string
    /** The row key as stored (hashed `sha256:<hex>` when longer than 400 characters). */
    readonly key: string
    /** The row id; "" for an `append` row that was already stored (the insert-or-ignore answers no id for it). */
    readonly id: string
    /** True when the row was inserted by this call. */
    readonly isNew: boolean
}

/** What one intake call came to; owner null = no such connection: nothing was written. */
export interface AccountWrite {
    /** The account, or null when the connection id names none. */
    readonly owner: AccountOwner | null
    /** One entry per input, in order. */
    readonly rows: ReadonlyArray<WrittenRow>
}

/** The pending row of a `wakes` type, locked by its consumer until the transaction ends. */
export interface PendingRow {
    /** The row id. */
    readonly id: string
    /** The type. */
    readonly type: string
    /** The row key. */
    readonly key: string
    /** The account the row belongs to. */
    readonly owner: AccountOwner
    /** The stored value. */
    readonly value: AccountValue
}

/** A pending row, or null when there is none (absent or already completed). */
export type OptionalPendingRow = PendingRow | null

/** One stored row, as a reader gets it. */
export interface StoredRow {
    /** The row id. */
    readonly id: string
    /** The type. */
    readonly type: string
    /** The version of the fields the value was written with. */
    readonly typeVersion: number
    /** The row key. */
    readonly key: string
    /** The stored value. */
    readonly value: AccountValue
    /** When it happened (or was last overwritten). */
    readonly occurredAt: Date
    /** When its consumer completed it; null while pending and for types that do not wake. */
    readonly processedAt: Date | null
}

/** A stored row, or null when the account holds none (or it expired). */
export type OptionalStoredRow = StoredRow | null

/** A stored row with the moment it entered the store, for cursor readers. */
export type EnteredRow = StoredRow & {
    /** `created_at` fixed-width in UTC with microseconds (`2026-11-11T10:00:00.123000Z`), the first half of the reading point. */
    readonly createdAt: string
}

/** A point in the order rows entered the store: after this row. */
export interface EnteredPoint {
    /** `created_at` of the row, as `after` answered it. */
    readonly createdAt: string
    /** The row id. */
    readonly id: string
}

/** The rows one type of an account holds. */
export interface AccountTypeStats {
    /** The type. */
    readonly type: string
    /** The type's purpose tag, null when it has none (or is no longer declared). */
    readonly purpose: string | null
    /** How many rows the account holds of it. */
    readonly rows: number
    /** When the newest row occurred; null when there is none. */
    readonly newestAt: Date | null
}

/** What an account's page shows of its data: counts read from the account's own rows, never from the provider. */
export interface AccountDataStats {
    /** One entry per type the account holds rows of, by type name. */
    readonly types: ReadonlyArray<AccountTypeStats>
}

/** The connection and the provider's id inside a connection-scoped delivery id (`<connection uuid>:<key>`). */
export interface ScopedDeliveryId {
    /** The connection. */
    readonly connectionId: string
    /** The row key, as stored (hashed when longer than 400 characters). */
    readonly externalId: string
}

/** The parts of a delivery id, or null when it does not start with a connection id. */
export type OptionalScopedDeliveryId = ScopedDeliveryId | null

/** Asked before every batch of a sweep: the fenced job refuses when it lost its claim. */
export type AccountSweepFence = () => Promise<void>

/** One CHECK of a type's partition: the member it holds to its declared type. */
export interface AccountPlanCheck {
    /** The constraint name, `<partition>_<snake(field)>_chk`. */
    readonly name: string
    /** The member. */
    readonly field: string
    /** Its declared type. */
    readonly fieldType: AccountFieldType
    /** True when every value holds it. */
    readonly required: boolean
    /** A text member's longest length, when declared. */
    readonly maxLength?: number
}

/** One member of an expression index. */
export interface AccountPlanIndexField {
    /** The member. */
    readonly name: string
    /** Its declared type (the index casts integer, number and boolean members). */
    readonly fieldType: AccountFieldType
}

/** One expression index of a type's partition, leading with `connection_id`. */
export interface AccountPlanIndex {
    /** The index name, `<partition>_<name>`. */
    readonly name: string
    /** The members, in index order. */
    readonly fields: ReadonlyArray<AccountPlanIndexField>
}

/** The partition of one declared type, its CHECKs and its indexes. */
export interface AccountPlanPartition {
    /** The type. */
    readonly type: string
    /** The partition table, `account_data_<type>`. */
    readonly partition: string
    /** One CHECK per declared member, in declaration order. */
    readonly checks: ReadonlyArray<AccountPlanCheck>
    /** The declared indexes, in declaration order. */
    readonly indexes: ReadonlyArray<AccountPlanIndex>
}

/** The DDL-free plan of every declared type, sorted by type: what `scripts/account-data-ddl.mjs` renders into the migration. */
export interface AccountDataPlan {
    /** One entry per declared type. */
    readonly partitions: ReadonlyArray<AccountPlanPartition>
}

/** Where the planner prints: `process.stdout` in the cli. */
export interface AccountDataPlanOutput {
    /** Writes one chunk of text. */
    write(text: string): unknown
}

/** One value checked against its declaration, with what the declaration derives from it. */
export interface CheckedRow {
    /** The declaration of its type. */
    readonly def: AccountDataTypeDef
    /** The value as its schema read it. */
    readonly value: Record<string, unknown>
    /** The row key. */
    readonly key: string
    /** When it happened, when the value says; undefined = the database clock. */
    readonly occurredAt: Date | undefined
}

/** The columns of a new row of an account. */
export interface AccountRowValues {
    /** The type. */
    readonly type: string
    /** The version of the type's fields. */
    readonly typeVersion: number
    /** The provider of the connection. */
    readonly provider: string
    /** The connection. */
    readonly connectionId: string
    /** The workspace of the connection. */
    readonly workspaceId: string
    /** The row key. */
    readonly key: string
    /** The value. */
    readonly value: Record<string, unknown>
    /** When it happened; absent = the database clock. */
    readonly occurredAt?: Date
}

/** One expiry rule of a type: rows older than `seconds` go; with `processedOnly`, only completed ones. */
export interface AccountExpiry {
    /** The type. */
    readonly type: string
    /** The age after which a row goes, in seconds. */
    readonly seconds: number
    /** True when a row still pending is never deleted (a `wakes` type). */
    readonly processedOnly: boolean
}

/** The members of a stored value. */
export type AccountValue = Readonly<Record<string, unknown>>

/** A declaration, or null when the type is not declared. */
export type OptionalAccountDataTypeDef = AccountDataTypeDef | null

/** The value of an indexed member a read compares with: a text, a number or a boolean (compared by its text form). */
export type AccountMemberValue = string | number | boolean

/** A second declared member a read narrows by, besides the first. */
export interface AccountMemberFilter {
    /** The declared member. */
    readonly field: string
    /** The value it must equal. */
    readonly equals: AccountMemberValue
}

/** The position an `advance` caller read before moving: a text or a number, or null when there was no row yet. */
export type AccountExpectedPosition = string | number | null

/** A point of the entered-order read, or null to read from the first row. */
export type OptionalEnteredPoint = EnteredPoint | null

/** A row read by its id, with its connection and the moment it entered the store. */
export type IdentifiedRow = StoredRow & {
    /** The connection the row belongs to. */
    readonly connectionId: string
    /** `created_at` fixed-width in UTC with microseconds (`2026-11-11T10:00:00.123000Z`). */
    readonly createdAt: string
}

/** A row read by its id, or null when there is none. */
export type OptionalIdentifiedRow = IdentifiedRow | null

/** What accountDataRows takes. */
export interface AccountDataRowsRequest {
    /** The connected account. */
    readonly connectionId: string
    /** The declared data type (`<provider>.<name>`). */
    readonly type: string
    /** How many rows, 1 to 100 (20 when absent). */
    readonly limit?: number | null | undefined
}

/** One declared data type an account stores. */
export interface AccountDataTypeView {
    /** The type's name. */
    readonly type: string
    /** The provider that writes it, or null for any provider. */
    readonly provider: string | null
    /** The version of its fields. */
    readonly version: number
    /** How its rows are written: append, overwrite or advance. */
    readonly write: string
    /** The names of its members. */
    readonly fields: ReadonlyArray<string>
}

/** One stored row of an account. */
export interface AccountDataRowView {
    /** The row. */
    readonly id: string
    /** The provider's own key of the row. */
    readonly key: string
    /** The version of the fields it was written with. */
    readonly typeVersion: number
    /** When it happened, ISO. */
    readonly occurredAt: string
    /** The value, as the provider sent it. */
    readonly value: Readonly<Record<string, unknown>>
}

/** The rows of one type of an account, or why none were read. */
export interface AccountDataRowsAnswer {
    /** `type_unknown` (not declared), `type_not_of_account` (the account's provider does not store it), or null. */
    readonly refusal: "type_unknown" | "type_not_of_account" | null
    /** The rows, newest first. */
    readonly rows: ReadonlyArray<AccountDataRowView>
}
