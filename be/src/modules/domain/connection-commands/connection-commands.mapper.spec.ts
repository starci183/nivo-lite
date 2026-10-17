import type * as SubjectModule from "./connection-commands.mapper"
import { Test } from "@nestjs/testing"
import { toConnectionCommand } from "./connection-commands.mapper"
import type { ConnectionCommandRow } from "./persistence/connection-commands.rows"

const SUBJECT = Symbol("connection-commands.mapper")
type Subject = Pick<typeof SubjectModule, "toConnectionCommand">

const buildSubject = async () => {
    const moduleRef = await Test.createTestingModule({
        providers: [{ provide: SUBJECT, useValue: { toConnectionCommand } }],
    }).compile()
    return moduleRef.get<Subject>(SUBJECT)
}

const row: ConnectionCommandRow = {
    id: "command-1",
    workspace_id: "workspace-1",
    user_id: "user-1",
    kind: "telegram.connect",
    input: { name: "Shop bot", token: "telegram-token" },
    status: "pending",
}

describe("toConnectionCommand", () => {
    it("maps every column of a pending command and preserves its object input", async () => {
        const subject = await buildSubject()

        const command = subject.toConnectionCommand(row)

        expect(command).toEqual({
            id: "command-1",
            workspaceId: "workspace-1",
            userId: "user-1",
            kind: "telegram.connect",
            input: { name: "Shop bot", token: "telegram-token" },
            status: "pending",
        })
        expect(command.input).toBe(row.input)
    })

    it("maps a done status to done", async () => {
        const subject = await buildSubject()

        expect(subject.toConnectionCommand({ ...row, status: "done" })).toEqual({
            id: "command-1",
            workspaceId: "workspace-1",
            userId: "user-1",
            kind: "telegram.connect",
            input: { name: "Shop bot", token: "telegram-token" },
            status: "done",
        })
    })

    it.each([undefined, null, false, 7, "token", ["token"]])(
        "reads a non-object input %p as no fields",
        async (input) => {
            const subject = await buildSubject()

            expect(subject.toConnectionCommand({ ...row, input, status: "unknown" })).toEqual({
                id: "command-1",
                workspaceId: "workspace-1",
                userId: "user-1",
                kind: "telegram.connect",
                input: {},
                status: "pending",
            })
        },
    )
})
