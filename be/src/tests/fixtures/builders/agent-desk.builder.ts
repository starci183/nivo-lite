import type { RunStop } from "@modules/domain/agent-threads"
import type { ProviderBoard } from "@modules/domain/tools"
import type { AgentNodeRights } from "@modules/domain/node-right-rollups"

/** An open approval stop of `agent-1`: the call to change a contact's phone, its owner item `item-1`. */
export const approvalStopOf = (over: Partial<RunStop> = {}): RunStop => ({
    id: "stop-1",
    version: "1",
    runId: "run-1",
    stepKey: "update-contact",
    agentId: "agent-1",
    workflowId: "wf-1",
    contactId: null,
    conversationId: "conv-1",
    kind: "approval",
    state: "open",
    reason: "Change the phone of Minh An",
    question: null,
    detail: {
        suggestions: [],
        facts: [
            { name: "tool", value: "nivo.api.crm.nivoweb.post.customers.code.contacts" },
            { name: "account", value: "NIVO Web CRM" },
            { name: "ability", value: "Update a contact" },
            { name: "phone", value: "0903 *** 221 -> 0938 *** 407" },
            { name: "workItemId", value: "item-1" },
            { name: "fingerprint", value: "fp-1" },
        ],
    },
    cardMessageId: "msg-1",
    customerLines: [],
    answers: [],
    decision: null,
    repeats: 1,
    stoppedAt: "2026-11-12T02:12:00.000Z",
    resolvedAt: null,
    ...over,
})

/** The rights board: the CRM provider with one working account, `agent-1` attached with one ability ticked. */
export const deskBoardOf = (over: Partial<ProviderBoard> = {}): ProviderBoard => ({
    providers: [
        {
            provider: "openapi",
            label: { vi: "CRM (vi)", en: "CRM" },
            kind: "records",
            kindLabel: { vi: "Records (vi)", en: "Records" },
            connected: true,
            abilities: [],
            accounts: [
                { connectionId: "conn-1", provider: "openapi", label: "NIVO Web", connected: true },
            ],
        },
    ],
    attachments: [{ agentId: "agent-1", connectionId: "conn-1", provider: "openapi" }],
    ...over,
})

/** One operation the roll-up names. */
const operationOf = (id: string, en: string | null): AgentNodeRights["rows"][number]["operation"] => ({
    id,
    title: en === null ? null : { vi: `${en} (vi)`, en },
    method: null,
    path: null,
    kind: "read",
    effect: null,
})

/** One running step's row of the roll-up. */
const rowOf = (
    operation: AgentNodeRights["rows"][number]["operation"],
    mode: "auto" | "ask",
): AgentNodeRights["rows"][number] => ({
    operation,
    connectionId: "conn-1",
    mode,
    versionNumber: 1,
    workflowId: "wf-1",
    workflowKey: "answer",
    workflowName: "Answer the team",
    nodeKey: "lookup",
    step: "lookup",
    stepTitle: null,
})

/** The roll-up of `agent-1`: reads by itself, a contact update asked first, renewals offered and held by no step. */
export const deskRightsOf = (over: Partial<AgentNodeRights> = {}): AgentNodeRights => {
    const read = operationOf("customer.list", "Read customers")
    const update = operationOf("contact.update", "Update a contact")
    const renew = operationOf("service.renew", "Renew a service")
    const untitled = operationOf("ticket.open", null)
    return {
        agentId: "agent-1",
        accounts: [
            {
                connectionId: "conn-1",
                provider: "openapi",
                kind: "records",
                name: "NIVO Web",
                stepsUsing: 2,
                operations: [read, update, renew, untitled],
            },
        ],
        rows: [rowOf(read, "auto"), rowOf(read, "auto"), rowOf(update, "ask")],
        ...over,
    }
}
