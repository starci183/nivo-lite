import { TOOL } from "@nivo-lite/blocks-core"
import type { FlowWake } from "@modules/domain/agent-graphs"
import type { NodeRow } from "@modules/domain/graph-nodes"
import { CATALOGUE, handOffWake } from "./flow-f-world.builder"
import type { FlowModelScript } from "./flow-f-world.builder"

/** One wake of the Sales agent on the fake ports: what the world holds, what the model answers, the wake, the workflow the engine must route it to and the run it must make. */
export interface SalesFlowCase {
    /** What the case shows. */
    readonly name: string
    /** The key of the Sales workflow the wake must be routed to. */
    readonly workflow: string
    /** The records the world holds. */
    readonly store: () => Record<string, Array<NodeRow>>
    /** The model's answers, by purpose. */
    readonly model: () => FlowModelScript
    /** The wake that starts the run. */
    readonly wake: () => FlowWake
    /** The node keys the run takes, in order. */
    readonly path: ReadonlyArray<string>
    /** The effects it runs, in order. */
    readonly effects: ReadonlyArray<string>
}

/** One turn of a step's agent, as the model answers it: a tool call, the final output, or its confusion. */
export type AgentTurn = Readonly<Record<string, unknown>>

/** The purposes the agents of the Sales consult chain ask the model under (`<node id>:<purpose>`). */
export const CONSULT_PURPOSE = "sales.consult-turn:consult"
export const CREATE_ORDER_PURPOSE = "sales.create-order:create-order"
export const SEND_QR_PURPOSE = "payment.request:send-qr"
export const ORDER_NOTICE_PURPOSE = "sales.order-notice:order-notice"

/** One line of the order draft the consult settles. */
export interface DraftPick {
    readonly catalogueItemId: string
    readonly quantity: number
}

/** The one flower pot the customer of the Sales scenarios settles on, and where it goes. */
export const POT_PICKS: ReadonlyArray<DraftPick> = [{ catalogueItemId: "c1", quantity: 1 }]
export const POT_ADDRESS = "69 Hang Xanh"
export const POT_PHONE = "0901234567"
export const POT_DELIVERY_AT = "Saturday 9-11"

/** What the consult's agent sends the customer in a turn that asks. */
export interface ConsultAsk {
    readonly conversationId: string
    readonly text: string
    /** The catalogue items whose photos go with the message. */
    readonly catalogueItemIds?: ReadonlyArray<string>
    /** The customer, when the consult already knows them. */
    readonly leadId?: string | null
    /** What of the order is settled so far. */
    readonly items?: ReadonlyArray<DraftPick>
}

/** A turn of the consult that is not complete: the agent sends the customer the one next question and answers `asked`. */
export const consultAsks = (ask: ConsultAsk): ReadonlyArray<AgentTurn> => [
    {
        call: {
            tool: TOOL.customerMessageSend,
            args: {
                conversationId: ask.conversationId,
                text: ask.text,
                ...(ask.catalogueItemIds === undefined ? {} : { catalogueItemIds: [...ask.catalogueItemIds] }),
            },
        },
    },
    {
        done: {
            branch: "asked",
            leadId: ask.leadId ?? null,
            items: [...(ask.items ?? [])],
            address: null,
            recipientPhone: null,
            deliveryAt: null,
        },
    },
]

/** The settled order draft a complete consult answers. */
export interface ConsultDraft {
    /** The customer, or null for one who is not a lead yet: the agent ensures the lead first and answers `ensuredLeadId`. */
    readonly leadId: string | null
    /** The id the lead tool answers for a customer who was not a lead. */
    readonly ensuredLeadId?: string
    readonly conversationId: string
    readonly channel: string
    readonly items: ReadonlyArray<DraftPick>
    readonly address: string
    /** The phone of the person who receives the delivery, and the delivery day and time in the customer's words. */
    readonly recipientPhone?: string
    readonly deliveryAt?: string
}

/** A turn of the consult that is complete: the agent ensures the lead when the customer is none yet, then answers `ready` with the draft. */
export const consultReady = (draft: ConsultDraft): ReadonlyArray<AgentTurn> => [
    ...(draft.leadId === null
        ? [{ call: { tool: TOOL.leadEnsure, args: { conversationId: draft.conversationId, channel: draft.channel } } }]
        : []),
    {
        done: {
            branch: "ready",
            leadId: draft.leadId ?? draft.ensuredLeadId ?? null,
            items: [...draft.items],
            address: draft.address,
            recipientPhone: draft.recipientPhone ?? POT_PHONE,
            deliveryAt: draft.deliveryAt ?? POT_DELIVERY_AT,
        },
    },
]

/** The order a create-order step records and confirms: the draft it is given, and the order the order tool answers. */
export interface OrderDraft {
    readonly leadId: string
    readonly items: ReadonlyArray<DraftPick>
    readonly address: string
    /** The id and number the order tool answers. */
    readonly orderId: string
    readonly orderNo: string
}

/** The agent of the create-order step: it records the order by ids and quantities, confirms it, and answers the order. */
export const createsOrder = (order: OrderDraft): ReadonlyArray<AgentTurn> => [
    {
        call: {
            tool: TOOL.orderRecord,
            args: {
                leadId: order.leadId,
                items: order.items.map((line) => ({ catalogueItemId: line.catalogueItemId, qty: line.quantity })),
                address: order.address,
            },
        },
    },
    { call: { tool: TOOL.orderConfirm, args: { orderId: order.orderId } } },
    { done: { orderId: order.orderId, orderNo: order.orderNo } },
]

/** The agent of the send-QR step: it sends the QR of the order by its id alone. */
export const sendsQr = (orderId: string): ReadonlyArray<AgentTurn> => [
    { call: { tool: TOOL.paymentQrCreate, args: { orderId } } },
    { done: { orderId, sent: true } },
]

/** The agent of the order-notice step: it posts the order card to the team by the order id alone. */
export const noticesOrder = (orderId: string): ReadonlyArray<AgentTurn> => [
    { call: { tool: TOOL.teamMessagePost, args: { kind: "order.summary", orderId } } },
    { done: { posted: true } },
]

/** The store of a Sales run: the shop's catalogue, and the customer as a lead. */
export const agreeingStore = (): Record<string, Array<NodeRow>> => ({
    "catalogue-item": [...CATALOGUE],
    "sales-lead": [{ id: "lead-1", contactName: "An" }],
})

/**
 * The model of a Sales run in which the customer settles one flower pot and the address in one turn: the consult answers `ready`, the
 * order is recorded and confirmed (the fake world answers `order-1`, number `DH001`), its QR is sent and the team is told.
 */
export const agrees = (): FlowModelScript => ({
    [CONSULT_PURPOSE]: [
        ...consultReady({
            leadId: "lead-1",
            conversationId: "conv-1",
            channel: "zalo",
            items: POT_PICKS,
            address: POT_ADDRESS,
        }),
    ],
    [CREATE_ORDER_PURPOSE]: [
        ...createsOrder({
            leadId: "lead-1",
            items: POT_PICKS,
            address: POT_ADDRESS,
            orderId: "order-1",
            orderNo: "DH001",
        }),
    ],
    [SEND_QR_PURPOSE]: [...sendsQr("order-1")],
    [ORDER_NOTICE_PURPOSE]: [...noticesOrder("order-1")],
})

/** The hand-off of a customer who only said a generic word ("flowers"): the front desk calls the consult with ONLY these params. */
const genericWake = (): FlowWake =>
    handOffWake(
        { workflow: "consult" },
        { leadId: "lead-1", conversationId: "conv-1", text: "flowers", channel: "zalo" },
        "flowers",
    )

/** A wake of Sales that is no chat: a tag of the system (a care timer, the website) with the plain data it carries. */
const systemWake = (
    source: string,
    subject: string,
    data: Readonly<Record<string, unknown>>,
    members: Readonly<Record<string, string>> = {},
): FlowWake => ({
    source: "tag",
    actorMemberId: null,
    context: { text: source, tagSource: source, subject, locale: "vi", ...members, tagContext: JSON.stringify(data) },
})

const PICTURED: Array<NodeRow> = CATALOGUE.map((row) => ({
    ...row,
    imageUrl: "https://api.example/p/c1.jpg",
    imageType: "image/jpeg",
}))

/** The order of the care cases, paid or still confirmed, with its customer and conversation. */
const careStore = (status: string): Record<string, Array<NodeRow>> => ({
    order: [
        {
            id: "order-1",
            orderNo: "DH001",
            amountVnd: 150_000,
            status,
            items: { lines: [] },
            leadId: "lead-1",
            shippedAt: null,
        },
    ],
    "sales-lead": [{ id: "lead-1", contactName: "An", consultFacts: { address: POT_ADDRESS } }],
    conversation: [{ id: "conv-1", leadId: "lead-1", lastAt: "2026-11-04T09:00:00.000Z" }],
})

const WEBSITE_FORM = {
    kind: "website-lead",
    chat: false,
    request: "two flower pots to 69 Hang Xanh",
    contact: { phone: "0900000000", email: null },
    firstContact: { route: "owner_item", via: "phone" },
}

/** The consult, the thank-you after the order, the payment reminder and the website form, each as one wake of the Sales agent. */
export const SALES_FLOW_CASES: ReadonlyArray<SalesFlowCase> = [
    {
        name: "asks a customer who named no product who the flowers are for, recording no order: the turn ends at the consult",
        workflow: "consult",
        store: () => ({ "catalogue-item": [...CATALOGUE], "sales-lead": [{ id: "lead-1" }] }),
        model: () => ({
            [CONSULT_PURPOSE]: [
                ...consultAsks({ conversationId: "conv-1", text: "Who are they for? And when?", leadId: "lead-1" }),
            ],
        }),
        wake: genericWake,
        path: ["consult"],
        effects: [TOOL.customerMessageSend],
    },
    {
        name: "recommends with the photos of the catalogue items, still asking, in one send",
        workflow: "consult",
        store: () => ({ "catalogue-item": [...PICTURED], "sales-lead": [{ id: "lead-1" }] }),
        model: () => ({
            [CONSULT_PURPOSE]: [
                ...consultAsks({
                    conversationId: "conv-1",
                    text: "These suit her. Which one, and where to?",
                    catalogueItemIds: ["c1"],
                    leadId: "lead-1",
                }),
            ],
        }),
        wake: genericWake,
        path: ["consult"],
        effects: [TOOL.customerMessageSend],
    },
    {
        name: "thanks the customer in the after-sale workflow when Accounting calls it with the paid order, and arms the check-in",
        workflow: "after-sale",
        store: () => careStore("paid"),
        model: () => ({
            "sales.after-sale:after-sale": [
                {
                    call: {
                        tool: TOOL.customerMessageSend,
                        args: { leadId: "lead-1", text: "Shop da nhan tien don DH001, cam on chi An!" },
                    },
                },
                { call: { tool: TOOL.leadUpdate, args: { leadId: "lead-1", consultStage: "after_sale" } } },
                { done: { orderId: "order-1", sent: true, asked: null } },
            ],
        }),
        wake: () => handOffWake({ workflow: "after-sale" }, { orderId: "order-1" }),
        path: ["thank", "plan", "thanked"],
        effects: [TOOL.customerMessageSend, TOOL.leadUpdate, TOOL.careSchedule],
    },
    {
        name: "tells the team of an order still unpaid when the stale timer falls due",
        workflow: "payment-reminder",
        store: () => careStore("confirmed"),
        model: () => ({
            "sales.unpaid-notice:unpaid-notice": [
                {
                    call: {
                        tool: TOOL.teamMessagePost,
                        args: {
                            kind: "message.text",
                            intent: "ask",
                            title: "Don DH001 chua thanh toan",
                            text: "Chi An chua chuyen khoan don DH001 sau mot ngay. Giu don hay huy a?",
                        },
                    },
                },
                { done: { orderId: "order-1", result: "told" } },
            ],
        }),
        wake: () =>
            systemWake("care", "order:order-1", {
                event: "care.due",
                careKind: "payment-stale",
                ref: "order-1",
                suffix: "",
                dueAt: "2026-11-04T10:00:00.000Z",
            }),
        path: ["which", "tell-team", "timed-out"],
        effects: [TOOL.teamMessagePost],
    },
    {
        name: "keeps what a website form tells and asks the team to call, never writing a chat line",
        workflow: "web-order",
        store: () => ({ "catalogue-item": [...CATALOGUE], "sales-lead": [{ id: "lead-1" }] }),
        model: () => ({
            "sales.web-order:web-order": [
                {
                    call: {
                        tool: TOOL.leadUpdate,
                        args: {
                            leadId: "lead-1",
                            consultStage: "close",
                            consultFacts: { address: POT_ADDRESS, picks: [{ catalogueItemId: "c1", quantity: 2 }] },
                        },
                    },
                },
                {
                    call: {
                        tool: TOOL.teamMessagePost,
                        args: {
                            kind: "message.text",
                            intent: "ask",
                            title: "Don web moi: goi xac nhan",
                            text: "Khach dat 2 Flower pot giao toi 69 Hang Xanh qua website. Goi 0900000000 de xac nhan don.",
                        },
                    },
                },
                { done: { leadId: "lead-1", summary: "Khach web dat 2 Flower pot, goi 0900000000 de xac nhan" } },
            ],
        }),
        wake: () => systemWake("website_lead", "sales-lead:lead-1", WEBSITE_FORM, { leadId: "lead-1" }),
        path: ["read", "to-owner"],
        effects: [TOOL.leadUpdate, TOOL.teamMessagePost],
    },
]
