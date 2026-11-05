import { Test } from "@nestjs/testing"
import { namesConnectionOrNone } from "./connection-scope.policy"

const SUBJECT = Symbol("connection-scope.policy")

const build = async () => {
    const moduleRef = await Test.createTestingModule({
        providers: [{ provide: SUBJECT, useValue: { namesConnectionOrNone } }],
    }).compile()
    return moduleRef.get<typeof import("./connection-scope.policy")>(SUBJECT)
}

describe("namesConnectionOrNone", () => {
    it.each([
        ["no ids", {}],
        ["a connection with its workspace", { connectionId: "c-1", workspaceId: "ws-1" }],
    ])("accepts %s", async (_name, value) => {
        const policy = await build()

        expect(policy.namesConnectionOrNone(value)).toBe(true)
    })

    it.each([
        ["a value that is not an object", "x"],
        ["null", null],
        ["a connection without its workspace", { connectionId: "c-1" }],
        ["a workspace without its connection", { workspaceId: "ws-1" }],
        ["an empty id", { connectionId: "", workspaceId: "ws-1" }],
        ["an id that is not text", { connectionId: 3, workspaceId: "ws-1" }],
    ])("refuses %s", async (_name, value) => {
        const policy = await build()

        expect(policy.namesConnectionOrNone(value)).toBe(false)
    })
})
