/** The destinations the Leads and Sales surfaces link to, named once. */
export const LEADS_ROUTES = {
    dashboard: "/dashboard",
    leads: "/leads",
    chat: "/chat",
} as const

/** The detail page of one lead. */
export const leadPath = (leadId: string): string => `${LEADS_ROUTES.leads}/${leadId}`

/** The page of the leads list that opens the new-lead form. */
export const newLeadPath = (): string => `${LEADS_ROUTES.leads}?new=1`
