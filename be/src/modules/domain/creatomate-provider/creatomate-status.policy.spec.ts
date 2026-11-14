import { Test } from "@nestjs/testing"
import {
    CREATOMATE_FAILED,
    CREATOMATE_RENDER_ID,
    CREATOMATE_RENDERING,
    CREATOMATE_STARTED,
    CREATOMATE_SUCCEEDED,
    CREATOMATE_WEBHOOK_DONE,
    CREATOMATE_WEBHOOK_FAILED,
} from "@tests/fixtures/builders/creatomate.builder"
import { CREATOMATE_STATUSES, creatomateRenderOf } from "@modules/integrations/creatomate"
import { creatomateCompletionOf, creatomateStateOf, creatomateStatusOf } from "./creatomate-status.policy"
import { TestWorldError, TestWorldErrorCode } from "@tests/world/test-world.error"

const SUBJECT = Symbol("creatomate-status.policy")

const build = async () => {
    const moduleRef = await Test.createTestingModule({
        providers: [{ provide: SUBJECT, useValue: { creatomateCompletionOf, creatomateStateOf, creatomateStatusOf } }],
    }).compile()
    return moduleRef.get<typeof import("./creatomate-status.policy")>(SUBJECT)
}

type Subject = Awaited<ReturnType<typeof build>>

const stateOf = (subject: Subject, body: unknown) => {
    const render = creatomateRenderOf(body)
    if (render === null) throw new TestWorldError({ code: TestWorldErrorCode.RowMissing, params: { what: "not a render" } })
    return subject.creatomateStateOf(render)
}

describe("creatomateStatusOf", () => {
    it.each([
        ["planned", "queued"],
        ["waiting", "queued"],
        ["transcribing", "rendering"],
        ["rendering", "rendering"],
        ["succeeded", "done"],
        ["failed", "failed"],
    ] as const)("%s is %s", async (word, status) => {
        const subject = await build()
        expect(subject.creatomateStatusOf(word)).toBe(status)
    })

    it("covers every status the docs list", async () => {
        const subject = await build()
        for (const word of CREATOMATE_STATUSES) expect(subject.creatomateStatusOf(word)).toBeDefined()
    })
})

describe("creatomateStateOf (statusOf from the doc fixtures)", () => {
    it("reads the start answer as queued", async () => {
        const subject = await build()
        expect(stateOf(subject, CREATOMATE_STARTED)).toEqual({ renderId: CREATOMATE_RENDER_ID, status: "queued" })
    })

    it("reads rendering", async () => {
        const subject = await build()
        expect(stateOf(subject, CREATOMATE_RENDERING)).toEqual({ renderId: CREATOMATE_RENDER_ID, status: "rendering" })
    })

    it("reads the succeeded example as done with its https url", async () => {
        const subject = await build()
        expect(stateOf(subject, CREATOMATE_SUCCEEDED)).toEqual({ renderId: CREATOMATE_RENDER_ID, status: "done", outputUrl: CREATOMATE_SUCCEEDED.url })
    })

    it("reads failed with the error_message", async () => {
        const subject = await build()
        expect(stateOf(subject, CREATOMATE_FAILED)).toEqual({ renderId: CREATOMATE_RENDER_ID, status: "failed", error: CREATOMATE_FAILED.error_message })
    })

    it("does not call a succeeded render without an https url done", async () => {
        const subject = await build()
        const { url: _url, ...noUrl } = CREATOMATE_SUCCEEDED
        expect(stateOf(subject, noUrl).status).toBe("rendering")
        expect(stateOf(subject, { ...CREATOMATE_SUCCEEDED, url: "http://cdn.test/v.mp4" }).status).toBe("rendering")
        expect(stateOf(subject, { ...CREATOMATE_SUCCEEDED, url: "not a url" }).status).toBe("rendering")
    })
})

describe("creatomateCompletionOf (the webhook body)", () => {
    it("reports a succeeded render as done with its https url", async () => {
        const subject = await build()
        expect(subject.creatomateCompletionOf(CREATOMATE_WEBHOOK_DONE)).toEqual({
            renderId: CREATOMATE_RENDER_ID,
            status: "done",
            outputUrl: CREATOMATE_SUCCEEDED.url,
        })
    })

    it("reports a failed render with the error_message", async () => {
        const subject = await build()
        expect(subject.creatomateCompletionOf(CREATOMATE_WEBHOOK_FAILED)).toEqual({
            renderId: CREATOMATE_RENDER_ID,
            status: "failed",
            error: CREATOMATE_FAILED.error_message,
        })
    })

    it("reports a failed render with no message as failed without an error", async () => {
        const subject = await build()
        expect(subject.creatomateCompletionOf({ id: CREATOMATE_RENDER_ID, status: "failed" })).toEqual({ renderId: CREATOMATE_RENDER_ID, status: "failed" })
    })

    it.each([
        ["planned", CREATOMATE_STARTED],
        ["rendering", CREATOMATE_RENDERING],
        ["succeeded with no url", { id: CREATOMATE_RENDER_ID, status: "succeeded" }],
        ["succeeded with an http url", { id: CREATOMATE_RENDER_ID, status: "succeeded", url: "http://cdn.test/v.mp4" }],
        ["no id", { status: "succeeded", url: "https://cdn.test/v.mp4" }],
        ["an unknown status", { id: "x", status: "exploded" }],
        ["a string", "hello"],
        ["null", null],
        ["an array", [CREATOMATE_SUCCEEDED]],
    ])("reports no finished render for %s", async (_name, body) => {
        const subject = await build()
        expect(subject.creatomateCompletionOf(body)).toBeNull()
    })
})
