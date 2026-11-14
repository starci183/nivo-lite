import { Test } from "@nestjs/testing"
import { AgentGraphsErrorCode } from "../errors/agent-graphs.error"
import { GRAPH_LAYOUT_SETTING, checkedLayout, layoutOfSettings, settingsWithLayout } from "./graph-layout.policy"

const SUBJECT = Symbol("graph-layout.policy")

interface Policies {
    readonly checkedLayout: typeof checkedLayout
    readonly layoutOfSettings: typeof layoutOfSettings
    readonly settingsWithLayout: typeof settingsWithLayout
}

const build = async (): Promise<Policies> => {
    const moduleRef = await Test.createTestingModule({
        providers: [{ provide: SUBJECT, useValue: { checkedLayout, layoutOfSettings, settingsWithLayout } }],
    }).compile()
    return moduleRef.get<Policies>(SUBJECT)
}

const thrown = (run: () => unknown): unknown => {
    try {
        run()
    } catch (error) {
        return error
    }
    return null
}

const KEYS = new Set(["a", "b"])

describe("checkedLayout", () => {
    it("keeps the last position of each workflow the agent has and drops the others", async () => {
        const { checkedLayout: check } = await build()

        const kept = check(
            [
                { workflowKey: "a", x: 1, y: 2 },
                { workflowKey: "gone", x: 5, y: 5 },
                { workflowKey: "a", x: 3, y: 4 },
            ],
            KEYS,
        )

        expect(kept).toEqual([{ workflowKey: "a", x: 3, y: 4 }])
    })

    it("refuses more than 200 keys, a coordinate that is not finite and one beyond 100000", async () => {
        const { checkedLayout: check } = await build()
        const many = Array.from({ length: 201 }, (_, index) => ({ workflowKey: `k${index}`, x: 0, y: 0 }))

        const refused = { code: AgentGraphsErrorCode.WorkflowRefused }

        expect(thrown(() => check(many, KEYS))).toMatchObject(refused)
        expect(thrown(() => check([{ workflowKey: "a", x: Number.NaN, y: 0 }], KEYS))).toMatchObject(refused)
        expect(thrown(() => check([{ workflowKey: "a", x: 0, y: -100001 }], KEYS))).toMatchObject(refused)
        expect(check([{ workflowKey: "a", x: 100000, y: -100000 }], KEYS)).toHaveLength(1)
    })
})

describe("layoutOfSettings", () => {
    it("reads the saved positions without the workflows the agent no longer has or entries it cannot read", async () => {
        const { layoutOfSettings: read } = await build()
        const settings = {
            [GRAPH_LAYOUT_SETTING]: [
                { workflowKey: "a", x: 1, y: 2 },
                { workflowKey: "gone", x: 3, y: 4 },
                { workflowKey: "b", x: "left", y: 4 },
                "junk",
            ],
        }

        expect(read(settings, KEYS)).toEqual([{ workflowKey: "a", x: 1, y: 2 }])
        expect(read({}, KEYS)).toEqual([])
        expect(read({ [GRAPH_LAYOUT_SETTING]: "nope" }, KEYS)).toEqual([])
    })
})

describe("settingsWithLayout", () => {
    it("replaces the layout whole and leaves the other settings alone", async () => {
        const { settingsWithLayout: write } = await build()

        expect(write({ processor: "nivo", [GRAPH_LAYOUT_SETTING]: [{ workflowKey: "old", x: 0, y: 0 }] }, [])).toEqual({
            processor: "nivo",
            [GRAPH_LAYOUT_SETTING]: [],
        })
    })
})
