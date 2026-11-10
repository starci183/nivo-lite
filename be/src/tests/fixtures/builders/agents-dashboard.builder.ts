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
export const itemRowOf: (overrides?: Partial<DashboardItemRow>) => DashboardItemRow = builder<DashboardItemRow>({
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

type WaitingExpectedDataItemsShape = {
    id: string
    title: string
    action: string
    customer: string
    at: string
    leadId: null
    resultHref: null
    decisionHref: string
}

type WaitingExpectedDataShape = {
    total: number
    items: Array<WaitingExpectedDataItemsShape>
}

type WaitingExpectedShape = {
    ok: boolean
    data: WaitingExpectedDataShape
}

/** The waiting region the dashboard shows for that scenario. */
export const WAITING_EXPECTED: WaitingExpectedShape = {
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

