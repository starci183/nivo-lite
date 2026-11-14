import type { AgentActionActivity } from "@modules/domain/work-items"
import { Test } from "@nestjs/testing"
import {
    agentOfItem as realAgentOfItem,
    agentRowsOf as realAgentRowsOf,
    approvalRowOf as realApprovalRowOf,
    autoRatesOf as realAutoRatesOf,
    decisionPathOf as realDecisionPathOf,
} from "./dashboard-agents.policy"
import type { AgentDirectory } from "./dashboard-agents.policy"

const DIRECTORY: AgentDirectory = {
    agents: [
        { id: "a-sales", module: "sales", name: "Sales", handle: "sales" },
        { id: "a-chat", module: "chatbot", name: "Chatbot", handle: "chatbot" },
        { id: "a-chat-2", module: "chatbot", name: "Chatbot 2", handle: "chatbot2" },
    ],
    installations: [
        { id: "i-chat-2", agentId: "a-chat-2" },
        { id: "i-orphan", agentId: null },
    ],
}

const activityOf = (changes: Partial<AgentActionActivity>): AgentActionActivity => ({
    department: "sales",
    installationId: null,
    action: "send_lead_offer",
    done: 0,
    autoDone: 0,
    failed: 0,
    previousDone: 0,
    previousAutoDone: 0,
    ...changes,
})

const SUBJECT = Symbol("dashboard-agents.policy")

const build = async () => {
    const moduleRef = await Test.createTestingModule({
        providers: [
            {
                provide: SUBJECT,
                useValue: {
                    agentOfItem: realAgentOfItem,
                    agentRowsOf: realAgentRowsOf,
                    approvalRowOf: realApprovalRowOf,
                    autoRatesOf: realAutoRatesOf,
                    decisionPathOf: realDecisionPathOf,
                },
            },
        ],
    }).compile()
    return moduleRef.get<{
        agentOfItem: typeof realAgentOfItem
        agentRowsOf: typeof realAgentRowsOf
        approvalRowOf: typeof realApprovalRowOf
        autoRatesOf: typeof realAutoRatesOf
        decisionPathOf: typeof realDecisionPathOf
    }>(SUBJECT)
}

describe("agentOfItem", () => {
    it("is the agent of the instance an item names", async () => {
        const policy = await build()

        expect(policy.agentOfItem(DIRECTORY, { department: "chatbot", installationId: "i-chat-2" })?.id).toBe(
            "a-chat-2",
        )
    })

    it("is the oldest agent of the department when the item names no instance, or an instance with no agent", async () => {
        const policy = await build()

        expect(policy.agentOfItem(DIRECTORY, { department: "chatbot", installationId: null })?.id).toBe("a-chat")
        expect(policy.agentOfItem(DIRECTORY, { department: "chatbot", installationId: "i-orphan" })?.id).toBe("a-chat")
    })

    it("is none for a department nobody answers for", async () => {
        const policy = await build()

        expect(policy.agentOfItem(DIRECTORY, { department: "video", installationId: null })).toBeNull()
    })
})

describe("autoRatesOf", () => {
    it("divides what policy alone finished by what was finished, now and before, and is null with nothing finished", async () => {
        const policy = await build()

        expect(
            policy.autoRatesOf([
                activityOf({ done: 8, autoDone: 6, previousDone: 10, previousAutoDone: 5 }),
                activityOf({ action: "send_care", done: 2, autoDone: 2, previousDone: 0 }),
            ]),
        ).toEqual({ current: 0.8, previous: 0.5 })
        expect(policy.autoRatesOf([])).toEqual({ current: null, previous: null })
    })
})

const rowsOfBusyAgents = async () =>
    (await build()).agentRowsOf({
        directory: DIRECTORY,
        activity: [
            activityOf({ done: 10, autoDone: 8, failed: 1 }),
            activityOf({ department: "chatbot", action: "reply_customer", done: 20, autoDone: 20 }),
            activityOf({
                department: "chatbot",
                installationId: "i-chat-2",
                action: "reply_customer",
                done: 5,
                autoDone: 0,
            }),
        ],
        responses: [
            { department: "sales", installationId: null, medianSeconds: 41 },
            { department: "chatbot", installationId: null, medianSeconds: 10 },
            { department: "chatbot", installationId: "i-chat-2", medianSeconds: null },
        ],
        waiting: [{ department: "sales", installationId: null, waiting: 3 }],
        creditsByModule: new Map([
            ["sales", 210],
            ["chatbot", 380],
        ]),
        failedRunsByAgent: new Map([["a-sales", 2]]),
    })

describe("agentRowsOf", () => {
    it("has one row per agent in the order of the directory", async () => {
        const rows = await rowsOfBusyAgents()

        expect(rows.map((row) => row.agentId)).toEqual(["a-sales", "a-chat", "a-chat-2"])
    })

    it("counts what an agent finished, its auto share, what waits, its errors (items and runs) and its median", async () => {
        const rows = await rowsOfBusyAgents()

        expect(rows[0]).toMatchObject({
            tasksDone: 10,
            autoRate: 0.8,
            waiting: 3,
            errors: 3,
            medianResponseSeconds: 41,
            minutesSaved: 20,
            credits: 210,
        })
    })

    it("gives an instance its own items and the credits of a module to its first agent only", async () => {
        const rows = await rowsOfBusyAgents()

        expect(rows[1]).toMatchObject({ tasksDone: 20, autoRate: 1, minutesSaved: 40, credits: 380 })
        expect(rows[2]).toMatchObject({ tasksDone: 5, autoRate: 0, medianResponseSeconds: null, credits: 0 })
    })

    it("has a row of nothing for an agent that did nothing", async () => {
        const policy = await build()

        const [row] = policy.agentRowsOf({
            directory: DIRECTORY,
            activity: [],
            responses: [],
            waiting: [],
            creditsByModule: new Map(),
            failedRunsByAgent: new Map(),
        })

        expect(row).toMatchObject({ tasksDone: 0, autoRate: null, waiting: 0, errors: 0, minutesSaved: 0, credits: 0 })
    })
})

describe("decisionPathOf", () => {
    it("opens the item in the workbench of its instance, or of its department", async () => {
        const policy = await build()

        expect(policy.decisionPathOf("sales", null, "w-1")).toBe("/agents/sales/workbench?focus=w-1")
        expect(policy.decisionPathOf("chatbot", "i-1", "w-1")).toBe("/agents/chatbot/i-1/workbench?focus=w-1")
    })
})

describe("approvalRowOf", () => {
    it("names the agent and carries the path that opens the item", async () => {
        const policy = await build()

        expect(
            policy.approvalRowOf(DIRECTORY, {
                id: "w-1",
                department: "sales",
                installationId: null,
                action: "send_lead_offer",
                createdAt: "2026-11-09T01:00:00.000Z",
                summary: "Offer DH-1",
                customer: "An",
            }),
        ).toEqual({
            id: "w-1",
            agentName: "Sales",
            action: "send_lead_offer",
            summary: "Offer DH-1",
            customer: "An",
            createdAt: "2026-11-09T01:00:00.000Z",
            href: "/agents/sales/workbench?focus=w-1",
        })
    })
})
