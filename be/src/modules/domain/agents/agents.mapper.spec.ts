import { Test } from "@nestjs/testing"
import { builder } from "@starci/jest-preset"
import { firstProfileOf, personaOf, refOf, summaryOf } from "./agents.mapper"
import type { AgentRecord } from "./agents.mapper"

const rowOf = builder<AgentRecord>({
    id: "a1",
    module: "chatbot",
    name: "Bot",
    handle: "bot",
    role: "Front desk",
    instructions: "Be kind",
    knowledge: "Open 9-5",
    approvalRule: "Ask first",
    status: "active",
    avatarUrl: null,
    createdAt: new Date("2026-10-01T00:00:00.000Z"),
})

const SUBJECT = Symbol("agents.mapper")

const buildSubject = async () => {
    const moduleRef = await Test.createTestingModule({
        providers: [{ provide: SUBJECT, useValue: { summaryOf, refOf, personaOf, firstProfileOf } }],
    }).compile()
    return moduleRef.get<{
        summaryOf: typeof summaryOf
        refOf: typeof refOf
        personaOf: typeof personaOf
        firstProfileOf: typeof firstProfileOf
    }>(SUBJECT)
}

describe("agents mapper", () => {
    it("maps the queried row to its complete profile", async () => {
        const subject = await buildSubject()

        expect(subject.firstProfileOf(rowOf())).toEqual({
            id: "a1",
            name: "Bot",
            handle: "bot",
            role: "Front desk",
            instructions: "Be kind",
            knowledge: "Open 9-5",
            approval_rule: "Ask first",
        })
    })

    it("answers no profile when the query has no row", async () => {
        const subject = await buildSubject()

        expect(subject.firstProfileOf(null)).toBeNull()
    })

    it("maps a row to the instance list entry", async () => {
        const subject = await buildSubject()

        expect(subject.summaryOf(rowOf({ avatarUrl: "https://cdn.example/a1.png" }))).toEqual({
            id: "a1",
            module: "chatbot",
            name: "Bot",
            handle: "bot",
            role: "Front desk",
            status: "active",
            avatarUrl: "https://cdn.example/a1.png",
            createdAt: "2026-10-01T00:00:00.000Z",
        })
    })

    it("maps a row to the reference the Office speaks through", async () => {
        const subject = await buildSubject()

        expect(subject.refOf(rowOf())).toEqual({ id: "a1", name: "Bot" })
    })

    it("maps a row to the persona and drops empty notes and rules", async () => {
        const subject = await buildSubject()

        expect(subject.personaOf(rowOf())).toEqual({
            name: "Bot",
            handle: "bot",
            role: "Front desk",
            instructions: "Be kind",
            knowledge: "Open 9-5",
            approvalRule: "Ask first",
        })
        expect(subject.personaOf(rowOf({ knowledge: "", approvalRule: "" }))).toMatchObject({
            knowledge: null,
            approvalRule: null,
        })
    })
})
