import { builder } from "@starci/jest-preset"

/** One work item line of the dashboard lists as the work item reads answer it. */
export interface DashboardItemRow {
    readonly id: string
    readonly action: string
    readonly leadId: string | null
    readonly at: string
    readonly summary: string | null
    readonly customer: string | null
    readonly resultHref: string | null
    readonly total: string
}

/** A dashboard line with the fields a scenario rarely changes filled. */
export const itemRowOf = builder<DashboardItemRow>({
    id: "wi1",
    action: "reply_customer",
    leadId: null,
    at: "2026-10-12T09:00:00.000Z",
    summary: "Price question",
    customer: "An",
    resultHref: null,
    total: "6",
})

/** The dashboard lists the work item reads answer, by list. */
export interface Lists {
    readonly waiting?: ReadonlyArray<DashboardItemRow>
    readonly done?: ReadonlyArray<DashboardItemRow>
}

/** The lists the work item reads answer in the dashboard scenario. */
export const DASHBOARD_LISTS: Lists = {
    waiting: [itemRowOf()],
    done: [itemRowOf({ id: "wi2", total: "2", resultHref: "/leads/l1" })],
}

/** The waiting region the dashboard shows for that scenario. */
export const WAITING_EXPECTED = {
    ok: true,
    data: {
        total: 6,
        items: [
            {
                id: "wi1",
                title: "Price question",
                action: "reply_customer",
                customer: "An",
                at: "2026-10-12T09:00:00.000Z",
                leadId: null,
                resultHref: null,
                decisionHref: "/agents/chatbot/i1/workbench?focus=wi1",
            },
        ],
    },
}

/** The connections region the dashboard shows for that scenario. */
export const CONNECTIONS_EXPECTED = {
    ok: true,
    data: [
        {
            id: "c1",
            name: "Shop bot",
            provider: "telegram",
            botUsername: null,
            accountMasked: null,
            status: "connected",
            access: "auto",
            purpose: "inbound_chat",
        },
    ],
}
