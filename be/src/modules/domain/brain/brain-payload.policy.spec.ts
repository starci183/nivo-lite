import { Test } from "@nestjs/testing"

import { sourcePayloadOf } from "./brain-payload.policy"

const POLICY = Symbol("./brain-payload.policy")

type PolicySubject = { sourcePayloadOf: typeof sourcePayloadOf }

const buildSubject = async () => {
    const moduleRef = await Test.createTestingModule({
        providers: [{ provide: POLICY, useValue: { sourcePayloadOf } }],
    }).compile()
    const subject = moduleRef.get<PolicySubject>(POLICY)

    return { subject }
}

describe("sourcePayloadOf", () => {
    it("returns the source and workspace identifiers of a source job", async () => {
        const { subject } = await buildSubject()

        const payload = { sourceId: "s1", workspaceId: "ws1" }
        expect(subject.sourcePayloadOf(payload)).toBe(payload)
        expect(subject.sourcePayloadOf(payload)).toEqual({ sourceId: "s1", workspaceId: "ws1" })
    })

    it("refuses jobs with missing or nonstring identifiers", async () => {
        const { subject } = await buildSubject()

        for (const payload of [
            {},
            [],
            { workspaceId: "ws1" },
            { sourceId: 1, workspaceId: "ws1" },
            { sourceId: "s1", workspaceId: 1 },
        ]) {
            expect(subject.sourcePayloadOf(payload)).toBeNull()
        }
    })
})
