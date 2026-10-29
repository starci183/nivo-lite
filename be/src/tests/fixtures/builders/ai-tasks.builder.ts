import type { CommandProposalInput } from "@modules/domain/ai-tasks"

/** An owner-authored receipt request and the references the proposal model may select. */
export const receiptCommandProposalInput = (): CommandProposalInput => ({
    agentName: "Accounting",
    options: [
        {
            command: "issue_receipt",
            description: { vi: "xuat phieu thu", en: "issue a receipt" },
            subjectType: "order",
            requiredFields: ["amount"],
        },
        {
            command: "ping",
            description: { vi: "xuat phieu thu", en: "issue a receipt" },
            subjectType: "order",
            requiredFields: [],
        },
    ],
    customers: [{ id: "l-1", name: "Lan" }],
    orders: [{ id: "o-1", order_no: "DH-1", lead_id: null }],
    text: "receipt for DH-1",
})
