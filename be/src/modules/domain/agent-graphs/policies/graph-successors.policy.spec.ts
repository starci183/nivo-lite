import { Test } from "@nestjs/testing"
import { OWNER_EXAMPLE, graphOf, nodeOf } from "@tests/fixtures/builders/agent-graph.builder"
import { successorsOf } from "./graph-successors.policy"

const SUBJECT = Symbol("graph-successors.policy")

const build = async () => {
    const moduleRef = await Test.createTestingModule({
        providers: [{ provide: SUBJECT, useValue: { successorsOf } }],
    }).compile()
    return moduleRef.get<{ successorsOf: typeof successorsOf }>(SUBJECT)
}

describe("successorsOf", () => {
    it("lists the next nodes of a node", async () => {
        const subject = await build()

        expect(subject.successorsOf(nodeOf({ next: ["a", "b"] }))).toEqual(["a", "b"])
    })

    it("lists the targets of the branches of a decide point instead", async () => {
        const subject = await build()
        const decide = graphOf(OWNER_EXAMPLE).nodes.find((node) => node.decide !== undefined)

        expect(decide === undefined ? [] : subject.successorsOf(decide)).toEqual(["act", "ask", "ask"])
    })
})
