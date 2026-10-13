/** One row of public.connection_commands as the back end reads it. */
export interface ConnectionCommandRow {
    readonly id: string
    readonly workspace_id: string
    readonly user_id: string
    readonly kind: string
    readonly input: unknown
    readonly status: string
}
