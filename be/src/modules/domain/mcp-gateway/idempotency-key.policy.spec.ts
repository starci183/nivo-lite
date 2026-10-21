import { createHash } from "node:crypto"
import { Test } from "@nestjs/testing"
import { builder } from "@starci/jest-preset"
import { withReplayKey } from "./idempotency-key.policy"
import type { GatewayCaller, GatewayToolSpec } from "./mcp-gateway.contracts"

/** The members of the subject under test. */
interface Subject {
    readonly withReplayKey: typeof withReplayKey
}

const SUBJECT = Symbol("idempotency-key.policy")

/** The policy functions, read through the Nest testing module. */
const build = async (): Promise<Subject> => {
    const moduleRef = await Test.createTestingModule({
        providers: [{ provide: SUBJECT, useValue: { withReplayKey } }],
    }).compile()
    return moduleRef.get<Subject>(SUBJECT)
}

const specOf = builder<GatewayToolSpec>({
    name: "booking.hold",
    description: "Hold a room.",
    scope: "write",
    inputSchema: {},
    defaultMode: "auto",
    idempotencyArg: "idempotencyKey",
})

const callerOf = builder<GatewayCaller>({
    workspaceId: "ws-1",
    agentId: "sales",
    conversationId: "conv-1",
    workItemId: "item-1",
})

const HOLD = { roomType: "deluxe", nights: 2 }

const sha256 = (text: string): string => createHash("sha256").update(text).digest("hex")

/** The key of HOLD for ws-1, step item-1: the hash of the workspace, the step, the tool and the canonical arguments' hash. */
const HOLD_KEY = `nivo:${sha256(JSON.stringify(["ws-1", "item-1", "hakuen.booking.hold", sha256('{"nights":2,"roomType":"deluxe"}')]))}`

describe("idempotency-key.policy", () => {
    it("fills one stable key per step, tool and arguments", async () => {
        const { withReplayKey } = await build()

        const first = withReplayKey(specOf(), callerOf(), "hakuen.booking.hold", HOLD)
        const again = withReplayKey(specOf(), callerOf(), "hakuen.booking.hold", { nights: 2, roomType: "deluxe" })

        expect(first).toEqual({ ...HOLD, idempotencyKey: HOLD_KEY })
        expect(again).toEqual(first)
        expect(withReplayKey(specOf(), callerOf({ opKey: "item-1:2" }), "hakuen.booking.hold", HOLD)).not.toEqual(first)
        expect(withReplayKey(specOf(), callerOf(), "hakuen.booking.hold", { ...HOLD, nights: 3 })).not.toEqual({
            ...first,
            nights: 3,
        })
        expect(withReplayKey(specOf(), callerOf({ workspaceId: "ws-2" }), "hakuen.booking.hold", HOLD)).not.toEqual(
            first,
        )
    })

    it("leaves a read, a tool without the argument, a caller's own key and a call with no step as they are", async () => {
        const { withReplayKey } = await build()

        expect(withReplayKey(specOf({ scope: "read" }), callerOf(), "hakuen.stay.current", HOLD)).toBe(HOLD)
        expect(withReplayKey(specOf({ idempotencyArg: undefined }), callerOf(), "x.order.place", HOLD)).toBe(HOLD)
        const own = { ...HOLD, idempotencyKey: "mine" }
        expect(withReplayKey(specOf(), callerOf(), "hakuen.booking.hold", own)).toBe(own)
        expect(withReplayKey(specOf(), callerOf({ workItemId: null }), "hakuen.booking.hold", HOLD)).toBe(HOLD)
    })
})
