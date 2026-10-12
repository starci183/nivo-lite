/** public.leads as the statements select it. */
export interface LeadsRow {
    readonly id: string
    readonly contact_name: string
    readonly company: string
    readonly channel: string
    readonly need: string
    readonly origin: string | null
    readonly stage: string
}
