import { Test } from "@nestjs/testing"
import type { NodeRunClaims } from "@modules/domain/graph-nodes"
import { runOfClaims } from "./gateway-run.policy"

/** The members of the subject under test. */
interface Subject {
    readonly runOfClaims: typeof runOfClaims
}

const SUBJECT = Symbol("gateway-run.policy")

/** The policy function, read through the Nest testing module. */
const build = async (): Promise<Subject> => {
    const moduleRef = await Test.createTestingModule({
        providers: [{ provide: SUBJECT, useValue: { runOfClaims } }],
    }).compile()
    return moduleRef.get<Subject>(SUBJECT)
}

const CLAIMS: NodeRunClaims = {
    workspaceId: "ws-1",
    agentId: "agent-1",
    runId: "run-1",
    conversationId: null,
    origin: "system",
    memberId: null,
    scope: "workspace",
    expiresAt: 1,
}

describe("gateway-run.policy", () => {
    it("reads the graph step a token signs, with no hand-off and no lead when it names none", async () => {
        const subject = await build()

        expect(subject.runOfClaims({ ...CLAIMS, locale: "en", stepTools: ["nivo.team.message.post"] })).toEqual({
            turnId: "run-1",
            locale: "en",
            origin: "system",
            memberId: null,
            handedOffBy: null,
            leadId: null,
            stepTools: ["nivo.team.message.post"],
        })
    })

    it("reads no step from a token without a language or an allow-list", async () => {
        const subject = await build()

        expect(subject.runOfClaims(CLAIMS)).toBeUndefined()
        expect(subject.runOfClaims({ ...CLAIMS, locale: "vi" })).toBeUndefined()
        expect(subject.runOfClaims({ ...CLAIMS, stepTools: [] })).toBeUndefined()
    })
})
