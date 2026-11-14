import { isProposedText, messageFactGroupsOf } from "./agent-message-facts"
import { agentMessageItemOf } from "./agent-message-item"
import { coreAgentMessageKinds, reportFactsKind, workflowStoppedPayload } from "@nivo-lite/agent-sdk/team-chat"

describe("messageFactGroupsOf", () => {
    it("keeps worded facts apart from technical ones, each in its given order, with distinct ids", () => {
        const groups = messageFactGroupsOf([
            { name: "Channel", value: "Zalo" },
            { name: "Error code", value: "ENTITY_ENGINE_QUERY_INVALID", technical: true },
            { name: "Reason", value: "The data read request is invalid." },
            { name: "Conversation id", value: "a544428d", technical: true },
            { name: "Channel", value: "Zalo", technical: false },
        ])
        expect(groups.worded.map((fact) => fact.name)).toEqual(["Channel", "Reason", "Channel"])
        expect(groups.technical.map((fact) => fact.value)).toEqual(["ENTITY_ENGINE_QUERY_INVALID", "a544428d"])
        const ids = [...groups.worded, ...groups.technical].map((fact) => fact.id)
        expect(new Set(ids).size).toBe(ids.length)
    })

    it("answers two empty groups for no facts", () => {
        expect(messageFactGroupsOf([])).toEqual({ worded: [], technical: [] })
    })
})

describe("isProposedText", () => {
    it("is a proposal when the message asks or approves, or names a customer it goes out to", () => {
        expect(isProposedText({ intent: "approve", outbound: undefined })).toBe(true)
        expect(isProposedText({ intent: "ask", outbound: undefined })).toBe(true)
        expect(isProposedText({ intent: "notify", outbound: { to: "Lan" } })).toBe(true)
    })

    it("is the agent's own words for a report or a notice to the team", () => {
        expect(isProposedText({ intent: "report", outbound: undefined })).toBe(false)
        expect(isProposedText({ intent: "notify", outbound: undefined })).toBe(false)
    })
})

describe("the report.facts kind", () => {
    const record = {
        id: "m-1",
        kind: "report.facts",
        intent: "report",
        title: "A turn could not run",
        payload: {
            text: "A turn stopped before the first step, after its retries.",
            facts: [
                { name: "Channel", value: "Zalo" },
                { name: "Error code", value: "ENTITY_ENGINE_QUERY_INVALID", technical: true },
            ],
        },
    }

    it("is a core kind, read only, and its payload reads through the card", () => {
        expect(coreAgentMessageKinds).toContain(reportFactsKind)
        expect(reportFactsKind.actions).toEqual({ approve: false, edit: "none", reject: false })
        const item = agentMessageItemOf(record, coreAgentMessageKinds)
        expect(item?.kind?.id).toBe("report.facts")
        expect(item?.state).toBeNull()
        expect(item?.payload).toEqual(record.payload)
    })

    it("refuses a fact without its value", () => {
        expect(reportFactsKind.payload.safeParse({ text: "x", facts: [{ name: "Channel" }] }).success).toBe(false)
    })
})

describe("the facts of a stopped workflow", () => {
    it("take an optional technical mark and still read the facts stored without it", () => {
        const base = {
            workflow: { moduleKey: "chatbot", key: "front-desk", title: "Front desk" },
            step: { key: "answer", nodeId: "chatbot.answer", title: "Answer a question" },
            runId: "run-1",
            leadId: null,
            conversationId: null,
            by: "engine",
            reason: "r",
            question: null,
            suggestions: [],
            decisions: [],
            repeats: 1,
            firstAt: "2026-11-11T00:00:00.000Z",
            lastAt: "2026-11-11T00:00:00.000Z",
        }
        const marked = workflowStoppedPayload.safeParse({
            ...base,
            facts: [{ name: "Error code", value: "ai_confused", technical: true }],
        })
        expect(marked.success && marked.data.facts[0]?.technical).toBe(true)
        const stored = workflowStoppedPayload.safeParse({ ...base, facts: [{ name: "code", value: "ai_confused" }] })
        expect(stored.success && stored.data.facts[0]?.technical).toBeUndefined()
    })
})
