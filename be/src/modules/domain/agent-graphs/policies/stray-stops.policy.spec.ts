import { Test } from "@nestjs/testing"
import { graphOf, nodeOf } from "@tests/fixtures/builders/agent-graph.builder"
import { withoutStrayStops as realWithoutStrayStops } from "./stray-stops.policy"

const SUBJECT = Symbol("stray-stops.policy")

const buildSubject = async () => {
    const moduleRef = await Test.createTestingModule({
        providers: [{ provide: SUBJECT, useValue: { withoutStrayStops: realWithoutStrayStops } }],
    }).compile()
    return moduleRef.get<{ withoutStrayStops: typeof realWithoutStrayStops }>(SUBJECT)
}

describe("withoutStrayStops", () => {
    it("drops a seeded stop nothing leads to and keeps one a branch reaches, and any other node", async () => {
        const subject = await buildSubject()
        const graph = {
            ...graphOf([]),
            nodes: [
                nodeOf({ key: "start", next: ["stop:used"] }),
                nodeOf({ key: "stop:used", kind: "output", step: "stop", next: [] }),
                nodeOf({ key: "stop:stray", kind: "output", step: "stop", next: [] }),
                nodeOf({ key: "own", kind: "output", step: "stop", next: [] }),
            ],
        }

        expect(subject.withoutStrayStops(graph).nodes.map((node) => node.key)).toEqual(["start", "stop:used", "own"])
    })
})
