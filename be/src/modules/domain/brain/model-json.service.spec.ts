import { Test } from "@nestjs/testing"
import { mock } from "@starci/jest-preset"
import { LOGGER } from "@modules/platform/logging"
import type { Logger } from "@modules/platform/logging"
import { BrainLogEvent } from "./brain.log-events"
import { ModelJsonService } from "./model-json.service"

const build = async () => {
    const logger = mock<Logger>()
    const moduleRef = await Test.createTestingModule({
        providers: [ModelJsonService, { provide: LOGGER, useValue: logger }],
    }).compile()
    return { service: moduleRef.get(ModelJsonService), logger }
}

describe("ModelJsonService", () => {
    it("reads objects from prose and case-insensitive markdown fences", async () => {
        const { service, logger } = await build()

        expect(service.jsonOf('Before ```JSON\n{"facts":[{"value":"Tea"}]}\n``` after')).toEqual({
            facts: [{ value: "Tea" }],
        })
        expect(service.jsonOf('```{"title":"Tea"}```')).toEqual({ title: "Tea" })
        expect(logger.error).not.toHaveBeenCalled()
    })

    it("tries a list first when it starts before an object or when there is no object", async () => {
        const { service, logger } = await build()

        expect(service.jsonOf('Before [{"value":"Tea"}] after')).toEqual([{ value: "Tea" }])
        expect(service.jsonOf('Before [1,"Tea"] after')).toEqual([1, "Tea"])
        expect(logger.error).not.toHaveBeenCalled()
    })

    it("tries an object first when it starts before a list", async () => {
        const { service, logger } = await build()

        expect(service.jsonOf('{"facts":[]}')).toEqual({ facts: [] })
        expect(logger.error).not.toHaveBeenCalled()
    })

    it("logs an unreadable object and still returns a valid nested list", async () => {
        const { service, logger } = await build()

        expect(service.jsonOf('{bad: ["Tea"]}')).toEqual(["Tea"])
        expect(logger.error).toHaveBeenCalledTimes(1)
        expect(logger.error).toHaveBeenCalledWith(BrainLogEvent.AnswerUnreadable, expect.any(SyntaxError))
    })

    it("logs an unreadable list and still returns a valid nested object", async () => {
        const { service, logger } = await build()

        expect(service.jsonOf('[bad, {"title":"Tea"}]')).toEqual({ title: "Tea" })
        expect(logger.error).toHaveBeenCalledTimes(1)
        expect(logger.error).toHaveBeenCalledWith(BrainLogEvent.AnswerUnreadable, expect.any(SyntaxError))
    })

    it("returns null after both candidates fail to parse", async () => {
        const { service, logger } = await build()

        expect(service.jsonOf("{bad: [wrong]}")).toBeNull()
        expect(logger.error).toHaveBeenCalledTimes(2)
        expect(logger.error).toHaveBeenNthCalledWith(1, BrainLogEvent.AnswerUnreadable, expect.any(SyntaxError))
        expect(logger.error).toHaveBeenNthCalledWith(2, BrainLogEvent.AnswerUnreadable, expect.any(SyntaxError))
    })

    it("skips missing, unmatched or backwards boundaries", async () => {
        const { service, logger } = await build()

        for (const answer of ["plain text", "{", "[", "} {", "] ["]) expect(service.jsonOf(answer)).toBeNull()
        expect(logger.error).not.toHaveBeenCalled()
    })
})
