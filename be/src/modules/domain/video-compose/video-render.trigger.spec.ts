import { Test } from "@nestjs/testing"
import { PROVIDER, TRIGGER } from "@nivo-lite/agent-sdk/names"
import { renderTriggerOf as realTriggerOf } from "./video-render.trigger"
import { renderRowOf } from "./video-render-data.policy"

const SUBJECT = Symbol("video-render.trigger")
type Subject = { triggerOf: typeof realTriggerOf }

const buildSubject = async (): Promise<Subject> => {
    const moduleRef = await Test.createTestingModule({
        providers: [{ provide: SUBJECT, useValue: { triggerOf: realTriggerOf } }],
    }).compile()
    return moduleRef.get<Subject>(SUBJECT)
}

const ORIGIN = { connectionId: "conn-1" }

describe("the compose providers' render trigger", () => {
    it("is declared once per compose provider (the same object every time), for the render verb, received by webhook, keyed by the render", async () => {
        const { triggerOf } = await buildSubject()
        const shotstack = triggerOf(PROVIDER.shotstack)

        expect([shotstack.provider, shotstack.name, shotstack.verb, shotstack.via, shotstack.key]).toEqual([
            PROVIDER.shotstack,
            "render.completed",
            TRIGGER.videoRenderCompleted,
            "webhook",
            { by: "data", member: "renderId" },
        ])
        expect(triggerOf(PROVIDER.shotstack)).toBe(shotstack)
        expect(triggerOf(PROVIDER.creatomate)).not.toBe(shotstack)
    })

    it("translates the stored row of a done render into one event with its facts, and of a failed one with the provider's words", async () => {
        const { triggerOf } = await buildSubject()
        const shotstack = triggerOf(PROVIDER.shotstack)
        const done = renderRowOf("shotstack", { renderId: "r-1", status: "done", outputUrl: "https://cdn.test/v.mp4" })
        const failed = renderRowOf("shotstack", { renderId: "r-2", status: "failed", error: "bad clip" })

        expect(shotstack.translate(done, ORIGIN)).toEqual({
            id: "r-1",
            data: { renderId: "r-1", status: "done", outputUrl: "https://cdn.test/v.mp4", provider: "shotstack" },
        })
        expect(shotstack.translate(failed, ORIGIN)?.data).toEqual({
            renderId: "r-2",
            status: "failed",
            error: "bad clip",
            provider: "shotstack",
        })
    })

    it("is pure (same row, same event) and fits its schemas; a row with no terminal status is dropped", async () => {
        const { triggerOf } = await buildSubject()
        const json2video = triggerOf(PROVIDER.json2video)
        const row = renderRowOf("json2video", { renderId: "r-3", status: "done", outputUrl: "https://cdn.test/w.mp4" })

        expect(json2video.translate(row, ORIGIN)).toEqual(json2video.translate(row, ORIGIN))
        expect(json2video.raw.safeParse(row).success).toBe(true)
        expect(json2video.data.safeParse(json2video.translate(row, ORIGIN)?.data).success).toBe(true)
        expect(json2video.translate({ ...row, status: "running" }, ORIGIN)).toBeNull()
    })
})
