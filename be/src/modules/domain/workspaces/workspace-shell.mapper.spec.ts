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
    agents: [],
    isFoundingMember: false,
}

describe("toShellFacts", () => {
    it("maps a shell object, keeping record rows and pausing only a paused agent", async () => {
        const subject = await buildSubject()
        expect(
            subject.toShellFacts({
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
            }),
        ).toEqual({
            isFoundingMember: true,
            agents: [
                { id: "a-1", name: "Mai", module: "sales", status: "paused" },
                { id: "a-2", name: "Lan", module: "chatbot", status: "active" },
                { id: "", name: "", module: "", status: "active" },
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
                is_founding_member: false,
                agents: "none",
            }),
        ).toEqual(EMPTY)
    })
})
