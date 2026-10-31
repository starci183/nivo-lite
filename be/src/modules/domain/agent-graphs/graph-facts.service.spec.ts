import { Test } from "@nestjs/testing"
import { mock } from "@starci/jest-preset"
import { LOGGER } from "@modules/platform/logging"
import type { Logger } from "@modules/platform/logging"
import { QUEUE_TIMEOUT } from "@modules/platform/queue"
import type { QueueTimeout } from "@modules/platform/queue"
import { AMOUNT_FACT, FACTS } from "@tests/fixtures/builders/agent-graph.builder"
import { AGENT_GRAPHS_OPTIONS, GRAPH_FACT_READERS } from "./agent-graphs.decorators"
import { AgentGraphsLogEvent } from "./agent-graphs.log-events"
import type { GraphFactReader } from "./agent-graphs.port"
import { GraphFactsService } from "./graph-facts.service"

const SUBJECT = { type: "order", id: "payment-1", workItemId: "item-1" }

const readerOf = (keys: ReadonlyArray<string>, read: GraphFactReader["read"]): GraphFactReader => ({
    facts: Object.values(FACTS).filter((fact) => keys.includes(fact.key)),
    read,
})

const build = async (readers: ReadonlyArray<GraphFactReader>, options: { readonly readTimeoutMs?: number } = {}) => {
    const logger = mock<Logger>()
    const cancel = jest.fn()
    const timeout = mock<QueueTimeout>({ schedule: jest.fn().mockReturnValue(cancel) })
    const moduleRef = await Test.createTestingModule({
        providers: [
            GraphFactsService,
            { provide: GRAPH_FACT_READERS, useValue: [...readers] },
            { provide: AGENT_GRAPHS_OPTIONS, useValue: { readTimeoutMs: options.readTimeoutMs } },
            { provide: QUEUE_TIMEOUT, useValue: timeout },
            { provide: LOGGER, useValue: logger },
        ],
    }).compile()
    return { service: moduleRef.get(GraphFactsService), logger, timeout, cancel }
}

describe("GraphFactsService.registry", () => {
    it("lists every fact the readers declare by key", async () => {
        const { service } = await build([
            readerOf([AMOUNT_FACT], jest.fn()),
            readerOf(["supplier_payment.kind"], jest.fn()),
        ])

        expect(Object.keys(service.registry())).toEqual([AMOUNT_FACT, "supplier_payment.kind"])
    })

    it("is empty while no module declares a fact", async () => {
        const { service } = await build([])

        expect(service.registry()).toEqual({})
    })
})

describe("GraphFactsService.read", () => {
    it("asks the reader that owns each fact for those facts only, and gathers the answers", async () => {
        const amount = jest.fn().mockResolvedValue({ [AMOUNT_FACT]: 7_200_000 })
        const kind = jest.fn().mockResolvedValue({ "supplier_payment.kind": "rent" })
        const { service, cancel } = await build([
            readerOf([AMOUNT_FACT], amount),
            readerOf(["supplier_payment.kind"], kind),
        ])

        await expect(service.read("ws-1", SUBJECT, [AMOUNT_FACT, "supplier_payment.kind"])).resolves.toEqual({
            [AMOUNT_FACT]: 7_200_000,
            "supplier_payment.kind": "rent",
        })
        expect(amount).toHaveBeenCalledWith("ws-1", SUBJECT, [AMOUNT_FACT])
        expect(kind).toHaveBeenCalledWith("ws-1", SUBJECT, ["supplier_payment.kind"])
        expect(cancel).toHaveBeenCalledTimes(2)
    })

    it("does not call a reader that owns none of the facts asked", async () => {
        const amount = jest.fn()
        const { service, timeout } = await build([readerOf([AMOUNT_FACT], amount)])

        await expect(service.read("ws-1", SUBJECT, ["supplier_payment.kind"])).resolves.toEqual({})
        expect(amount).not.toHaveBeenCalled()
        expect(timeout.schedule).not.toHaveBeenCalled()
    })

    it("leaves a fact out, and logs it, when its reader fails", async () => {
        const failing = jest.fn().mockRejectedValue(new Error("books are down"))
        const { service, logger, cancel } = await build([readerOf([AMOUNT_FACT], failing)])

        await expect(service.read("ws-1", SUBJECT, [AMOUNT_FACT])).resolves.toEqual({})

        expect(logger.error).toHaveBeenCalledWith(AgentGraphsLogEvent.FactUnreadable, expect.any(Error), {
            workspaceId: "ws-1",
            subjectId: "payment-1",
        })
        expect(cancel).toHaveBeenCalledTimes(1)
    })

    it("leaves a fact out when its reader outlasts the time limit, two seconds unless the options say otherwise", async () => {
        const slow = jest.fn(() => new Promise<never>(() => undefined))
        const built = await build([readerOf([AMOUNT_FACT], slow)])
        const custom = await build([readerOf([AMOUNT_FACT], slow)], { readTimeoutMs: 500 })
        built.timeout.schedule.mockImplementation((run: () => void) => {
            run()
            return built.cancel
        })
        custom.timeout.schedule.mockImplementation((run: () => void) => {
            run()
            return custom.cancel
        })

        await expect(built.service.read("ws-1", SUBJECT, [AMOUNT_FACT])).resolves.toEqual({})
        await expect(custom.service.read("ws-1", SUBJECT, [AMOUNT_FACT])).resolves.toEqual({})

        expect(built.timeout.schedule).toHaveBeenCalledWith(expect.any(Function), 2000)
        expect(custom.timeout.schedule).toHaveBeenCalledWith(expect.any(Function), 500)
    })
})
