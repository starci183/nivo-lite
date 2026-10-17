import { Test } from "@nestjs/testing"
import { agentIdFor, threadKeyFor } from "./agent-id.policy"

const SUBJECT = Symbol("agent-id.policy")

const build = async () => {
    const moduleRef = await Test.createTestingModule({
        providers: [{ provide: SUBJECT, useValue: { agentIdFor, threadKeyFor } }],
    }).compile()
    return moduleRef.get<typeof import("./agent-id.policy")>(SUBJECT)
}

describe("agent ids", () => {
    it("derives one agent per workspace and module", async () => {
        const subject = await build()

        expect(subject.agentIdFor("0123abcd-0000-4000-8000-000000000000", "Chat_Bot!")).toBe("ws-0123abcd-chatbot")
    })

    it("derives the thread key inside an agent", async () => {
        const subject = await build()

        expect(subject.threadKeyFor("ws-0123abcd-chatbot", "conv-1")).toBe("agent:ws-0123abcd-chatbot:conv-1")
    })
})
