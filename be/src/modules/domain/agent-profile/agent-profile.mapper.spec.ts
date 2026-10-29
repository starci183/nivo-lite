import { Test } from "@nestjs/testing"
import { builder } from "@starci/jest-preset"
import { headOf, recentOf, ruleLineOf } from "./agent-profile.mapper"
import type { AgentHeadRead, RecentWorkRead } from "./agent-profile-reads.contracts"
import type { AuthorityRuleEntity } from "@modules/domain/authority-rules"

type Subject = {
    headOf: typeof headOf
    recentOf: typeof recentOf
    ruleLineOf: typeof ruleLineOf
}

const SUBJECT = Symbol("agent-profile.mapper")

const buildSubject = async () => {
    const moduleRef = await Test.createTestingModule({
        providers: [{ provide: SUBJECT, useValue: { headOf, recentOf, ruleLineOf } }],
    }).compile()
    return moduleRef.get<Subject>(SUBJECT)
}

const headRowOf = builder<AgentHeadRead>({
    id: "a1",
    name: "AI Sales",
    handle: "ai-sales",
    role: "Sales assistant",
    module: "sales",
    status: "active",
    avatarUrl: "https://cdn.example/a1.png",
    roomName: "Sales",
    operatingMode: "assist",
})

const recentRowOf = builder<RecentWorkRead>({
    id: "w1",
    action: "send_quote",
    status: "waiting_decision",
    at: "2026-10-22T09:00:00.000Z",
    summary: "Close the group booking",
    customer: "Minh An",
    leadId: "l1",
})

const ruleRowOf = builder<Pick<AuthorityRuleEntity, "action" | "department" | "mode" | "limitVnd" | "note">>({
    action: "send_quote",
    department: "sales",
    mode: "ask",
    limitVnd: 5_000_000,
    note: "The owner confirms",
})

describe("headOf", () => {
    it("maps an agent row to its header", async () => {
        const subject = await buildSubject()

        expect(subject.headOf(headRowOf())).toEqual({
            id: "a1",
            name: "AI Sales",
            handle: "ai-sales",
            role: "Sales assistant",
            module: "sales",
            status: "active",
            avatarUrl: "https://cdn.example/a1.png",
            roomName: "Sales",
            operatingMode: "assist",
        })
    })

    it("keeps a missing picture, room and instance as null", async () => {
        const subject = await buildSubject()

        expect(subject.headOf(headRowOf({ avatarUrl: null, roomName: null, operatingMode: null }))).toMatchObject({
            avatarUrl: null,
            roomName: null,
            operatingMode: null,
        })
    })
})

describe("ruleLineOf", () => {
    it("keeps what the agent page shows of a rule", async () => {
        const subject = await buildSubject()

        expect(subject.ruleLineOf(ruleRowOf())).toEqual({
            action: "send_quote",
            department: "sales",
            mode: "ask",
            limitVnd: 5_000_000,
            note: "The owner confirms",
        })
    })
})

describe("recentOf", () => {
    it("maps a work item row to a line of recent work", async () => {
        const subject = await buildSubject()

        expect(subject.recentOf(recentRowOf())).toEqual({
            id: "w1",
            action: "send_quote",
            title: "Close the group booking",
            customer: "Minh An",
            status: "waiting_decision",
            at: "2026-10-22T09:00:00.000Z",
            leadId: "l1",
        })
    })

    it("turns a missing summary and customer into empty texts", async () => {
        const subject = await buildSubject()

        expect(subject.recentOf(recentRowOf({ summary: null, customer: null, leadId: null }))).toMatchObject({
            title: "",
            customer: "",
            leadId: null,
        })
    })
})
