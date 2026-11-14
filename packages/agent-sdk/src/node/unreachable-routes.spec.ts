import { z } from "zod"
import { checkTemplateNode } from "../template/builder/template-example"
import { defineTemplateNode } from "../template/builder/template-node"
import { runTemplateNode, type TemplateHostPorts } from "./template-host"

// `ctx.run.unreachable`: the step's routes the engine cannot follow in this installation (a hand-off on the route's road names a workflow no
// installed agent holds). The engine gives it; the host hands it on untouched; an example may name it; absent means every route is open.

const routes = ["sell", "book", "ask"] as const

const choosing = defineTemplateNode({
    id: "test.routes",
    title: { key: "t" },
    description: { vi: "Nút thử nghiệm của bộ kiểm tra.", en: "A test node of the checks." },
    tools: [],
    mode: "auto",
    accounts: [],
    input: z.object({}),
    output: z.object({ route: z.enum(routes), closed: z.array(z.string().max(20)).max(3) }),
    routes: { by: "route", names: ["sell", "book", "ask"] },
    run: (_input, ctx) => {
        const closed = ctx.run.unreachable ?? []
        return Promise.resolve({ route: closed.includes("book") ? "ask" : "book", closed: [...closed] })
    },
    examples: [
        { name: "every route open when the engine names none", params: {}, input: {}, output: { route: "book", closed: [] } },
        { name: "a route the installation cannot follow", params: {}, input: {}, unreachable: ["book"], output: { route: "ask", closed: ["book"] } },
    ],
})

const ports: TemplateHostPorts = {
    callTool: () => Promise.resolve({}),
    model: { text: () => Promise.reject(new Error("x")), json: () => Promise.reject(new Error("x")) },
    now: () => new Date("2026-01-05T02:00:00.000Z"),
}

describe("ctx.run.unreachable", () => {
    it("the runner hands the node the routes the engine names closed", async () => {
        const ran = await runTemplateNode(
            {
                node: choosing,
                params: {},
                input: {},
                turn: { turnId: "t", workspaceId: "ws-1", agentId: "a", subject: null },
                run: { id: "run-1", at: "2026-01-05T09:00:00.000+07:00", day: "2026-01-05", item: null, queue: [], waiting: 0, unreachable: ["book"] },
                workspace: { timeZone: "Asia/Ho_Chi_Minh", name: "Shop" },
                key: "run-1:s",
                tools: new Map(),
                effects: new Map(),
            },
            ports,
        )
        expect(ran.output).toEqual({ route: "ask", closed: ["book"] })
    })

    it("the example runner hands an example's `unreachable` on, and none when the example names none", async () => {
        expect(await checkTemplateNode(choosing)).toEqual([])
    })
})
