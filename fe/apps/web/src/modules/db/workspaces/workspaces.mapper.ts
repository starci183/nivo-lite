const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/iu

/** One workspace the caller belongs to, with the caller's seat in it. */
export interface MembershipItem {
    readonly workspaceId: string
    readonly name: string
    /** `active`, `pending_payment` or `cancelled`. */
    readonly status: string
    /** ISO 8601. */
    readonly createdAt: string
    readonly businessType: string | null
    /** `owner`, `manager` or `staff`. */
    readonly role: string
    /** `active` or `disabled`. */
    readonly memberStatus: string
}

/** The workspace a caller just created. */
export interface CreatedWorkspaceItem {
    readonly id: string
}

/** One `workspace_members` row with the workspace embedded. */
export interface MembershipRowShape {
    readonly workspace_id: string
    readonly role: string
    readonly status: string
    readonly workspaces: {
        readonly name: string
        readonly status: string
        readonly created_at: string
        readonly business_type: string | null
    } | null
}

/** Flattens the membership rows into items; a row whose workspace the caller cannot read is dropped. */
export const membershipItemsOf = (rows: ReadonlyArray<MembershipRowShape>): ReadonlyArray<MembershipItem> =>
    rows.flatMap((row): Array<MembershipItem> =>
        row.workspaces === null
            ? []
            : [
                  {
                      workspaceId: row.workspace_id,
                      name: row.workspaces.name,
                      status: row.workspaces.status,
                      createdAt: row.workspaces.created_at,
                      businessType: row.workspaces.business_type,
                      role: row.role,
                      memberStatus: row.status,
                  },
              ],
    )

type Parsed<T> = { readonly success: true; readonly data: T } | { readonly success: false }

/** Bounds the name typed for a new workspace. */
export const workspaceNameSchema = {
    safeParse: (input: unknown): Parsed<string> => {
        if (typeof input !== "string") return { success: false }
        const name = input.trim()
        return name === "" || name.length > 120 ? { success: false } : { success: true, data: name }
    },
}

/** Whether a function answered the id of a workspace. */
export const isWorkspaceId = (value: unknown): value is string => typeof value === "string" && UUID.test(value)
