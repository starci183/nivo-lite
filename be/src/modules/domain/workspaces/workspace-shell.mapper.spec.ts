import { Test } from "@nestjs/testing"
import { toShellFacts } from "./workspace-shell.mapper"

const SUBJECT = Symbol("workspace-shell.mapper")

const buildSubject = async () => {
    const moduleRef = await Test.createTestingModule({
        providers: [{ provide: SUBJECT, useValue: { toShellFacts } }],
    }).compile()
    return moduleRef.get<typeof import("./workspace-shell.mapper")>(SUBJECT)
}

const EMPTY = {
    leadCount: 0,
    openResponsibilityCount: 0,
    agents: [],
    hasChatbot: false,
    isFoundingMember: false,
    approvals: [],
    exceptions: [],
    pendingDecisions: 0,
}

describe("toShellFacts", () => {
    it("maps a shell object, keeping record rows and pausing only a paused agent", async () => {
        const subject = await buildSubject()
        expect(
            subject.toShellFacts({
                lead_count: 4,
                open_responsibility_count: 2,
                pending_decisions: 1,
                has_chatbot: true,
                is_founding_member: true,
                agents: [
                    { id: "a-1", name: "Mai", module: "sales", status: "paused" },
                    { id: "a-2", name: "Lan", module: "chatbot", status: "active" },
                    { id: 9, name: null, module: false, status: 1 },
                    "drop",
                    null,
                    ["nested"],
                    3,
                    true,
                ],
                pending: [
                    {
                        id: "x-1",
                        draft: "Hello",
                        next_action: "send",
                        lead_id: "l-1",
                        contact_name: "Minh",
                    },
                    { id: null, draft: 1, next_action: 2, lead_id: false },
                ],
                exceptions: [
                    { id: "w-1", lead_id: "l-1", contact_name: "Minh", summary: "Late", error: "timeout" },
                    {},
                ],
            }),
        ).toEqual({
            leadCount: 4,
            openResponsibilityCount: 2,
            pendingDecisions: 1,
            hasChatbot: true,
            isFoundingMember: true,
            agents: [
                { id: "a-1", name: "Mai", module: "sales", status: "paused" },
                { id: "a-2", name: "Lan", module: "chatbot", status: "active" },
                { id: "", name: "", module: "", status: "active" },
            ],
            approvals: [
                { id: "x-1", draft: "Hello", nextAction: "send", leadId: "l-1", contactName: "Minh" },
                { id: "", draft: "", nextAction: null, leadId: null, contactName: null },
            ],
            exceptions: [
                { id: "w-1", leadId: "l-1", contactName: "Minh", summary: "Late", error: "timeout" },
                { id: "", leadId: null, contactName: null, summary: null, error: null },
            ],
        })
    })

    it("reads a non-object, wrong types and flags that are not strictly true as empty", async () => {
        const subject = await buildSubject()

        expect(subject.toShellFacts(null)).toEqual(EMPTY)
        expect(subject.toShellFacts(["agents"])).toEqual(EMPTY)
        expect(subject.toShellFacts("shell")).toEqual(EMPTY)
        expect(subject.toShellFacts(undefined)).toEqual(EMPTY)
        expect(subject.toShellFacts(4)).toEqual(EMPTY)
        expect(subject.toShellFacts(true)).toEqual(EMPTY)
        expect(
            subject.toShellFacts({
                lead_count: "4",
                open_responsibility_count: null,
                pending_decisions: false,
                has_chatbot: "yes",
                is_founding_member: false,
                agents: "none",
                pending: null,
                exceptions: { id: "not-a-list" },
            }),
        ).toEqual(EMPTY)
    })
})
