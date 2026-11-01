import { Test } from "@nestjs/testing"
import type { AgentThreadMessage } from "@modules/domain/agent-messages"
import { withFiles } from "./chat-thread.mapper"

const SUBJECT = Symbol("chat-thread.mapper")

const build = async () => {
    const moduleRef = await Test.createTestingModule({
        providers: [{ provide: SUBJECT, useValue: { withFiles } }],
    }).compile()
    return moduleRef.get<typeof import("./chat-thread.mapper")>(SUBJECT)
}

const line = (id: string): AgentThreadMessage => ({
    id,
    role: "user",
    body: "hello",
    createdAt: "2026-11-01T00:00:00.000Z",
})
const file = (id: string, messageId: string) => ({
    id,
    messageId,
    name: "a.png",
    contentType: "image/png",
    url: "https://store/a.png",
})

describe("withFiles", () => {
    it("gives each message its own files, in the order they came", async () => {
        const subject = await build()
        const first = file("f-1", "m-1")
        const second = file("f-2", "m-1")

        expect(subject.withFiles([line("m-1"), line("m-2")], [first, second])).toEqual([
            { ...line("m-1"), files: [first, second] },
            { ...line("m-2"), files: [] },
        ])
    })

    it("answers an empty thread with no messages", async () => {
        const subject = await build()

        expect(subject.withFiles([], [file("f-1", "m-1")])).toEqual([])
    })
})
