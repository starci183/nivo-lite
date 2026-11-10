import { Test } from "@nestjs/testing"
import { mock } from "@starci/jest-preset"
import { stepViewOf } from "@tests/fixtures/builders/agent-runs.builder"
import { LOGGER } from "@modules/platform/logging"
import type { Logger } from "@modules/platform/logging"
import { AgentGraphRunNoticesService } from "./agent-graph-run-notices.service"
import { AgentGraphsLogEvent } from "./agent-graphs.log-events"

/** The run notices with only the developer log behind them: what is left of them once the thread posts the stop card itself. */
const build = async () => {
    const logger = mock<Logger>()
    const moduleRef = await Test.createTestingModule({
        providers: [AgentGraphRunNoticesService, { provide: LOGGER, useValue: logger }],
    }).compile()
    return { notices: moduleRef.get(AgentGraphRunNoticesService), logger }
}

const STEP = stepViewOf({ stepKey: "notify", nodeKey: "notify", kind: "graph_node" })

const TROUBLE = {
    kind: "threw" as const,
    code: "handler_threw",
    text: "TypeError: claim.names is not iterable",
    data: {},
}

describe("AgentGraphRunNoticesService", () => {
    it("keeps the raw cause of a troubled step for developers, whatever the AI core then decides", async () => {
        const { notices, logger } = await build()

        notices.troubled(STEP, TROUBLE)

        expect(logger.warn.mock.calls).toEqual([
            [
                AgentGraphsLogEvent.StepTroubled,
                {
                    runId: "run-1",
                    stepKey: "notify",
                    kind: "threw",
                    code: "handler_threw",
                    cause: "TypeError: claim.names is not iterable",
                },
            ],
        ])
        expect(logger.info.mock.calls).toEqual([])
    })

    it("records a step whose output the AI core produced, so the run went on", async () => {
        const { notices, logger } = await build()

        notices.recovered(STEP, TROUBLE)

        expect(logger.info.mock.calls).toEqual([
            [AgentGraphsLogEvent.StepRecovered, { runId: "run-1", stepKey: "notify", code: "handler_threw" }],
        ])
        expect(logger.warn.mock.calls).toEqual([])
    })
})
