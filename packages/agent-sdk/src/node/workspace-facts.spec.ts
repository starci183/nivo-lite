import { z } from "zod"
import { EXAMPLE_WORKSPACE, checkTemplateNode } from "../template/builder/template-example"
import { defineTemplateNode } from "../template/builder/template-node"
import { runTemplateNode, type TemplateHostPorts } from "./template-host"

// `ctx.workspace`: the workspace's own facts a node reads (its time zone, its name, its logo when one is saved), given by the engine.

const naming = defineTemplateNode({
    id: "test.facts",
    title: { key: "t" },
    description: { vi: "N\u00fat th\u1eed nghi\u1ec7m c\u1ee7a b\u1ed9 ki\u1ec3m tra.", en: "A test node of the checks." },
    tools: [],
    mode: "auto",
    accounts: [],
    input: z.object({}),
    output: z.object({ zone: z.string().max(200), name: z.string().max(200), logo: z.string().max(200).nullable() }),
    run: (_input, ctx) => Promise.resolve({ zone: ctx.workspace.timeZone, name: ctx.workspace.name, logo: ctx.workspace.logo ?? null }),
    examples: [
        {
            name: "the example workspace",
            params: {},
            input: {},
            output: { zone: EXAMPLE_WORKSPACE.timeZone, name: EXAMPLE_WORKSPACE.name, logo: null },
        },
        {
            name: "a workspace of its own",
            params: {},
            input: {},
            workspace: { timeZone: "Asia/Tokyo", name: "Hoa Mai", logo: "https://cdn.example/logo.png" },
            output: { zone: "Asia/Tokyo", name: "Hoa Mai", logo: "https://cdn.example/logo.png" },
        },
    ],
})

const ports: TemplateHostPorts = {
    callTool: () => Promise.resolve({}),
    model: { text: () => Promise.reject(new Error("x")), json: () => Promise.reject(new Error("x")) },
    now: () => new Date("2026-01-05T02:00:00.000Z"),
}

describe("ctx.workspace", () => {
    it("the runner hands the node the facts the engine gives", async () => {
        const ran = await runTemplateNode(
            {
                node: naming,
                params: {},
                input: {},
                turn: { turnId: "t", workspaceId: "ws-1", agentId: "a", subject: null },
                run: { id: "run-1", at: "2026-01-05T09:00:00.000+07:00", day: "2026-01-05", item: null, queue: [], waiting: 0 },
                workspace: { timeZone: "Asia/Ho_Chi_Minh", name: "Ti\u1ec7m Hoa", logo: "https://x/l.png" },
                key: "run-1:s",
                tools: new Map(),
                effects: new Map(),
            },
            ports,
        )
        expect(ran.output).toEqual({ zone: "Asia/Ho_Chi_Minh", name: "Ti\u1ec7m Hoa", logo: "https://x/l.png" })
    })

    it("the example runner supplies a default workspace, and an example may name its own", async () => {
        expect(await checkTemplateNode(naming)).toEqual([])
    })
})
