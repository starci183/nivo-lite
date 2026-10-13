import { toConnectionCommand } from "./connection-commands.mapper"
import type { ConnectionCommandRow } from "./persistence/connection-commands.rows"

const row: ConnectionCommandRow = {
    id: "command-1",
    workspace_id: "workspace-1",
    user_id: "user-1",
    kind: "telegram.connect",
    input: { name: "Shop bot", token: "telegram-token" },
    status: "pending",
}

describe("toConnectionCommand", () => {
    it("maps every column of a pending command and preserves its object input", () => {
        const command = toConnectionCommand(row)

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

    it("maps a done status to done", () => {
        expect(toConnectionCommand({ ...row, status: "done" })).toEqual({
            id: "command-1",
            workspaceId: "workspace-1",
            userId: "user-1",
            kind: "telegram.connect",
            input: { name: "Shop bot", token: "telegram-token" },
            status: "done",
        })
    })

    it.each([undefined, null, false, 7, "token", ["token"]])("reads a non-object input %p as no fields", (input) => {
        expect(toConnectionCommand({ ...row, input, status: "unknown" })).toEqual({
            id: "command-1",
            workspaceId: "workspace-1",
            userId: "user-1",
            kind: "telegram.connect",
            input: {},
            status: "pending",
        })
    })
})
