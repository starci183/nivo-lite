import { Test } from "@nestjs/testing"
import { AMOUNT_FACT, FACTS } from "@tests/fixtures/builders/agent-graph.builder"
import { GRAPH_FACT_READERS } from "./agent-graphs.decorators"
import type { GraphFactReader } from "./agent-graphs.port"
import { GraphFactsService } from "./graph-facts.service"

const readerOf = (keys: ReadonlyArray<string>): GraphFactReader => ({
    facts: Object.values(FACTS).filter((fact) => keys.includes(fact.key)),
})

const build = async (readers: ReadonlyArray<GraphFactReader>) => {
    const moduleRef = await Test.createTestingModule({
        providers: [GraphFactsService, { provide: GRAPH_FACT_READERS, useValue: [...readers] }],
    }).compile()
    return { service: moduleRef.get(GraphFactsService) }
}

describe("GraphFactsService.registry", () => {
    it("lists every fact the readers declare by key", async () => {
        const { service } = await build([
            readerOf([AMOUNT_FACT]),
            readerOf(["supplier_payment.kind"]),
        ])

        expect(Object.keys(service.registry())).toEqual([AMOUNT_FACT, "supplier_payment.kind"])
    })

    it("is empty while no module declares a fact", async () => {
        const { service } = await build([])

        expect(service.registry()).toEqual({})
    })
})
