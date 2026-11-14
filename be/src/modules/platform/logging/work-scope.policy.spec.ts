import { Test } from "@nestjs/testing"
import { withWorkScope, withWorkStep, workInScope } from "./work-scope.policy"

const SUBJECT = Symbol("work-scope.policy")

/** The functions of the policy under test, as Nest provides them. */
interface Subject {
    readonly withWorkScope: typeof withWorkScope
    readonly withWorkStep: typeof withWorkStep
    readonly workInScope: typeof workInScope
}

/** The subject, built the way Nest provides it. */
const build = async (): Promise<Subject> => {
    const moduleRef = await Test.createTestingModule({
        providers: [{ provide: SUBJECT, useValue: { withWorkScope, withWorkStep, workInScope } }],
    }).compile()
    return moduleRef.get<Subject>(SUBJECT)
}

describe("work scope", () => {
    it("is null outside any work, and holds the work for everything it awaits", async () => {
        const subject = await build()
        expect(subject.workInScope()).toBeNull()

        const seen = await subject.withWorkScope({ kind: "document_read", ref: "source:s1" }, async () => {
            await Promise.resolve()
            return subject.workInScope()
        })

        expect(seen).toEqual({ kind: "document_read", ref: "source:s1", stepKey: null, agentId: null })
        expect(subject.workInScope()).toBeNull()
    })

    it("an inner scope names its own kind and keeps what the outer one named that it does not (a node inside a chat turn)", async () => {
        const subject = await build()
        const seen = await subject.withWorkScope({ kind: "chat_turn", ref: "message:r1/m1", agentId: "a1" }, () =>
            subject.withWorkScope({ kind: "node", stepKey: "reply" }, () => Promise.resolve(subject.workInScope())),
        )

        expect(seen).toEqual({ kind: "node", ref: "message:r1/m1", stepKey: "reply", agentId: "a1" })
    })
})

describe("withWorkStep", () => {
    it("sets the step inside the work in scope, keeping its kind and record", async () => {
        const subject = await build()
        const seen = await subject.withWorkScope({ kind: "document_read", ref: "source:s1" }, () =>
            subject.withWorkStep("triage", "brain", () => Promise.resolve(subject.workInScope())),
        )
        expect(seen).toEqual({ kind: "document_read", ref: "source:s1", stepKey: "triage", agentId: null })
    })

    it("names the work by the fallback kind when no scope is open", async () => {
        const subject = await build()
        await expect(subject.withWorkStep("search", "knowledge_search", () => Promise.resolve(subject.workInScope()))).resolves.toEqual(
            {
                kind: "knowledge_search",
                ref: null,
                stepKey: "search",
                agentId: null,
            },
        )
    })
})
