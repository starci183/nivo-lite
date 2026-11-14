/** One field a person changes. */
export interface UpdateConnectionField {
    /** The key of the field. */
    readonly key: string
    /** The new value; an empty secret keeps the sealed one. */
    readonly value: string
}

/** What updateConnection takes. */
export interface UpdateConnectionRequest {
    /** The workspace the request is made in. */
    readonly workspaceId: string
    /** The connected account. */
    readonly connectionId: string
    /** The new display name; absent keeps it. */
    readonly displayName?: string | null | undefined
    /** The fields that change. */
    readonly fields: ReadonlyArray<UpdateConnectionField>
}
