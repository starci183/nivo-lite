import { Test } from "@nestjs/testing"
import { mock } from "@starci/jest-preset"
import { FAKE_COMPOSE, FAKE_OUTPUT } from "@tests/fixtures/builders/video-compose.builder"
import { VIDEO_RENDER_PURPOSE as VIDEO_RENDER_PURPOSESubject, isSoundCompletion as isSoundCompletionSubject, renderDataTypeOf as renderDataTypeOfSubject, renderEventOf as renderEventOfSubject, renderRowOf as renderRowOfSubject } from "./video-render-data.policy"

const SUBJECT = Symbol("video-render-data.policy")

const build = async (): Promise<{ VIDEO_RENDER_PURPOSE: typeof VIDEO_RENDER_PURPOSESubject; isSoundCompletion: typeof isSoundCompletionSubject; renderDataTypeOf: typeof renderDataTypeOfSubject; renderEventOf: typeof renderEventOfSubject; renderRowOf: typeof renderRowOfSubject }> => {
    const moduleRef = await Test.createTestingModule({
        providers: [{ provide: SUBJECT, useValue: mock<{ VIDEO_RENDER_PURPOSE: typeof VIDEO_RENDER_PURPOSESubject; isSoundCompletion: typeof isSoundCompletionSubject; renderDataTypeOf: typeof renderDataTypeOfSubject; renderEventOf: typeof renderEventOfSubject; renderRowOf: typeof renderRowOfSubject }>({ VIDEO_RENDER_PURPOSE: VIDEO_RENDER_PURPOSESubject, isSoundCompletion: isSoundCompletionSubject, renderDataTypeOf: renderDataTypeOfSubject, renderEventOf: renderEventOfSubject, renderRowOf: renderRowOfSubject }) }],
    }).compile()
    return moduleRef.get<{ VIDEO_RENDER_PURPOSE: typeof VIDEO_RENDER_PURPOSESubject; isSoundCompletion: typeof isSoundCompletionSubject; renderDataTypeOf: typeof renderDataTypeOfSubject; renderEventOf: typeof renderEventOfSubject; renderRowOf: typeof renderRowOfSubject }>(SUBJECT)
}

describe("the <provider>.render data type", () => {
    let VIDEO_RENDER_PURPOSE: typeof VIDEO_RENDER_PURPOSESubject
    let isSoundCompletion: typeof isSoundCompletionSubject
    let renderDataTypeOf: typeof renderDataTypeOfSubject
    let renderEventOf: typeof renderEventOfSubject
    let renderRowOf: typeof renderRowOfSubject

    beforeAll(async () => {
        ;({ VIDEO_RENDER_PURPOSE, isSoundCompletion, renderDataTypeOf, renderEventOf, renderRowOf } = await build())
    })

    it("is declared sound (append, keyed by the render id, wakes, 30 days, purpose video.render)", () => {
        expect(renderDataTypeOf(FAKE_COMPOSE)).toMatchObject({
            name: `${FAKE_COMPOSE}.render`,
            provider: FAKE_COMPOSE,
            write: "append",
            key: ["renderId"],
            wakes: true,
            retention: { days: 30 },
            purpose: VIDEO_RENDER_PURPOSE,
        })
    })

    it("keeps the completion's members as the adapter mapped them, the provider named, an absent member absent", () => {
        expect(renderRowOf(FAKE_COMPOSE, { renderId: "r-1", status: "done", outputUrl: FAKE_OUTPUT })).toEqual({
            renderId: "r-1",
            status: "done",
            outputUrl: FAKE_OUTPUT,
            provider: FAKE_COMPOSE,
        })
        expect(renderEventOf("row-1", { renderId: "r-1", status: "failed" })).toEqual({
            id: "r-1",
            occurredAt: null,
            payload: { renderRowId: "row-1", renderId: "r-1", status: "failed" },
        })
    })

    it.each([
        [{ renderId: "r-1", status: "done", outputUrl: FAKE_OUTPUT }, true],
        [{ renderId: "r-1", status: "failed" }, true],
        [{ renderId: "r-1", status: "done" }, false],
        [{ renderId: "r-1", status: "done", outputUrl: "http://cdn.test/r.mp4" }, false],
        [{ renderId: " ", status: "failed" }, false],
    ] as const)("a completion %j is sound: %s", (completion, sound) => {
        expect(isSoundCompletion(completion)).toBe(sound)
    })
})
