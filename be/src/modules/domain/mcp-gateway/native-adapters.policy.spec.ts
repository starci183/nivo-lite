import { Test } from "@nestjs/testing"
import { McpGatewayError } from "./errors/mcp-gateway.error"
import { gatewayArgumentsSchema } from "./gateway-tools.schema"
import type { NativeAdapter } from "./mcp-gateway.contracts"
import { withEffectTools, withoutShadowed } from "./native-adapters.policy"

/** The members of the subject under test. */
interface Subject {
    readonly withoutShadowed: typeof withoutShadowed
    readonly withEffectTools: typeof withEffectTools
}

const SUBJECT = Symbol("native-adapters.policy")

/** The policy function, read through the Nest testing module. */
const build = async (): Promise<Subject> => {
    const moduleRef = await Test.createTestingModule({
        providers: [{ provide: SUBJECT, useValue: { withoutShadowed, withEffectTools } }],
    }).compile()
    return moduleRef.get<Subject>(SUBJECT)
}

const adapter = (key: string): NativeAdapter => ({
    manifest: { key, name: key, kind: "native", contractVersion: `${key}@1`, tools: [] },
    invoke: () => Promise.resolve({}),
})

describe("native-adapters.policy", () => {
    it("keeps every adapter when no two share a key", async () => {
        const subject = await build()
        const [sepay, einvoice, brain] = [adapter("sepay"), adapter("einvoice"), adapter("brain")]

        expect(subject.withoutShadowed([sepay, einvoice, brain])).toStrictEqual([sepay, einvoice, brain])
    })

    it("gives the place of a default to the adapter that comes later under the same key", async () => {
        const subject = await build()
        const [sepay, einvoice, brain, richer] = [
            adapter("sepay"),
            adapter("einvoice"),
            adapter("brain"),
            adapter("sepay"),
        ]

        const kept = subject.withoutShadowed([sepay, einvoice, brain, richer])

        expect(kept).toHaveLength(3)
        expect(kept[0]).toBe(richer)
        expect(kept[1]).toBe(einvoice)
        expect(kept[2]).toBe(brain)
    })

    it("answers none for none", async () => {
        const subject = await build()

        expect(subject.withoutShadowed([])).toStrictEqual([])
    })
})

/** An adapter whose tools answer which adapter ran them. */
const toolsAdapter = (key: string, tools: ReadonlyArray<string>, by: string, timeoutMs?: number): NativeAdapter => ({
    manifest: {
        key,
        name: by,
        kind: "native",
        contractVersion: `${by}@1`,
        ...(timeoutMs === undefined ? {} : { timeoutMs }),
        tools: tools.map((name) => ({
            name,
            description: name,
            scope: "write",
            inputSchema: {},
            defaultMode: "ask",
            argumentSchema: gatewayArgumentsSchema,
        })),
    },
    invoke: (_workspaceId, tool) => Promise.resolve({ by, tool }),
})

const CALLER = { agentId: "agent-1", conversationId: null }

describe("native-adapters.policy withEffectTools", () => {
    it("joins an effect domain to the native connector of its key, each tool run by the adapter declaring it", async () => {
        const subject = await build()
        const native = toolsAdapter("agent", ["turn", "history"], "runtime")
        const effects = toolsAdapter("agent", ["tag"], "effects", 15_000)

        const [agent] = subject.withEffectTools([native], [effects])

        expect(agent?.manifest).toMatchObject({ key: "agent", name: "runtime", timeoutMs: 15_000 })
        expect(agent?.manifest.tools.map((spec) => spec.name)).toEqual(["turn", "history", "tag"])
        await expect(agent?.invoke("ws-1", "tag", {}, CALLER)).resolves.toEqual({ by: "effects", tool: "tag" })
        await expect(agent?.invoke("ws-1", "turn", {}, CALLER)).resolves.toEqual({ by: "runtime", tool: "turn" })
    })

    it("adds every other effect domain as a connector of its own after the natives", async () => {
        const subject = await build()
        const sepay = adapter("sepay")
        const order = toolsAdapter("order", ["create", "confirm"], "effects")

        expect(subject.withEffectTools([sepay], [order])).toEqual([sepay, order])
    })

    it("refuses two adapters declaring the same tool under one key", async () => {
        const subject = await build()

        expect(() =>
            subject.withEffectTools([toolsAdapter("agent", ["tag"], "runtime")], [toolsAdapter("agent", ["tag"], "effects")]),
        ).toThrow(McpGatewayError)
    })
})
