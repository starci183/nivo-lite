import { builder } from "@starci/jest-preset"
import { firstProfileOf, personaOf, refOf, summaryOf } from "./agents.mapper"
import type { AgentRow } from "./persistence/agents.rows"

const rowOf = builder<AgentRow>({
    id: "a1",
    workspace_id: "w1",
    module: "chatbot",
    name: "Bot",
    handle: "bot",
    role: "Front desk",
    instructions: "Be kind",
    knowledge: "Open 9-5",
    approval_rule: "Ask first",
    status: "active",
    created_at: "2026-10-01T00:00:00.000Z",
})

describe("agents mapper", () => {
    it("maps only the first queried row to its complete profile", () => {
        expect(firstProfileOf([rowOf(), rowOf({ id: "a2", name: "Other bot" })])).toEqual({
            id: "a1",
            name: "Bot",
            handle: "bot",
            role: "Front desk",
            instructions: "Be kind",
            knowledge: "Open 9-5",
            approval_rule: "Ask first",
        })
    })

    it("answers no profile when the query has no row", () => {
        expect(firstProfileOf([])).toBeNull()
    })

    it("maps a row to the instance list entry", () => {
        expect(summaryOf(rowOf())).toEqual({
            id: "a1",
            module: "chatbot",
            name: "Bot",
            handle: "bot",
            role: "Front desk",
            status: "active",
            createdAt: "2026-10-01T00:00:00.000Z",
        })
    })

    it("maps a row to the reference the Office speaks through", () => {
        expect(refOf(rowOf())).toEqual({ id: "a1", name: "Bot" })
    })

    it("maps a row to the persona and drops empty notes and rules", () => {
        expect(personaOf(rowOf())).toEqual({
            name: "Bot",
            handle: "bot",
            role: "Front desk",
            instructions: "Be kind",
            knowledge: "Open 9-5",
            approvalRule: "Ask first",
        })
        expect(personaOf(rowOf({ knowledge: "", approval_rule: "" }))).toMatchObject({
            knowledge: null,
            approvalRule: null,
        })
    })
})
