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

    it("a slice that does not parse while another does is a retry (info, slice kinds), never an unreadable answer", async () => {
        const { service, logger } = await build()

        expect(service.jsonOf('{bad: ["Tea"]}')).toEqual(["Tea"])
        expect(service.jsonOf('[bad, {"title":"Tea"}]')).toEqual({ title: "Tea" })
        expect(logger.info).toHaveBeenNthCalledWith(1, BrainLogEvent.AnswerSliceRetried, { workspaceId: null, failed: "object", parsed: "list" })
        expect(logger.info).toHaveBeenNthCalledWith(2, BrainLogEvent.AnswerSliceRetried, { workspaceId: null, failed: "list", parsed: "object" })
        expect(logger.warn).not.toHaveBeenCalled()
        expect(logger.error).not.toHaveBeenCalled()
    })

    it("an answer with no slice that parses is ONE unreadable event, with its length and the slices tried, never its text", async () => {
        const { service, logger } = await build()

        expect(service.jsonOf("{bad: [wrong]}", "ws-1")).toBeNull()
        expect(logger.warn).toHaveBeenCalledTimes(1)
        // Whose call it was (TRIAGE-6: Round U counted 9 dev-wide with no workspace on the line).
        expect(logger.warn).toHaveBeenCalledWith(BrainLogEvent.AnswerUnreadable, { workspaceId: "ws-1", chars: 14, slicesTried: 2 })
        expect(logger.error).not.toHaveBeenCalled()
    })

    it("an answer with no object or list at all is unreadable too, once", async () => {
        const { service, logger } = await build()

        for (const answer of ["plain text", "{", "[", "} {", "] ["]) expect(service.jsonOf(answer)).toBeNull()
        expect(logger.warn).toHaveBeenCalledTimes(5)
        expect(logger.warn).toHaveBeenCalledWith(BrainLogEvent.AnswerUnreadable, { workspaceId: null, chars: 10, slicesTried: 0 })
    })
})
