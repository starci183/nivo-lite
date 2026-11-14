import { Test } from "@nestjs/testing"
import { mock } from "@starci/jest-preset"
import { SHOTSTACK_WEBHOOK_DONE, SHOTSTACK_WEBHOOK_FAILED } from "@tests/fixtures/builders/shotstack.builder"
import { SHOTSTACK_WEBHOOK as SHOTSTACK_WEBHOOKSubject, shotstackCompletionOf as shotstackCompletionOfSubject } from "./shotstack-callback.policy"

const SUBJECT = Symbol("shotstack-callback.policy")

describe("shotstack-callback.policy built the way Nest does", () => {
    let SHOTSTACK_WEBHOOK: typeof SHOTSTACK_WEBHOOKSubject
    let shotstackCompletionOf: typeof shotstackCompletionOfSubject

    beforeAll(async () => {
        const moduleRef = await Test.createTestingModule({
            providers: [{ provide: SUBJECT, useValue: mock<{ SHOTSTACK_WEBHOOK: typeof SHOTSTACK_WEBHOOKSubject; shotstackCompletionOf: typeof shotstackCompletionOfSubject }>({ SHOTSTACK_WEBHOOK: SHOTSTACK_WEBHOOKSubject, shotstackCompletionOf: shotstackCompletionOfSubject }) }],
        }).compile()
        ;({ SHOTSTACK_WEBHOOK, shotstackCompletionOf } = moduleRef.get<{ SHOTSTACK_WEBHOOK: typeof SHOTSTACK_WEBHOOKSubject; shotstackCompletionOf: typeof shotstackCompletionOfSubject }>(SUBJECT))
    })

describe("shotstackCompletionOf", () => {
    it("maps the docs' done callback to a done completion with its https address", () => {
        expect(shotstackCompletionOf(SHOTSTACK_WEBHOOK_DONE)).toEqual({
            renderId: "6d7acbe6-e7c1-4cf8-b8ea-94e7522878cc",
            status: "done",
            outputUrl: SHOTSTACK_WEBHOOK_DONE.url,
        })
    })

    it("maps a failed callback to a failed completion with the reason against `error`", () => {
        expect(shotstackCompletionOf(SHOTSTACK_WEBHOOK_FAILED)).toEqual({
            renderId: "6d7acbe6-e7c1-4cf8-b8ea-94e7522878cc",
            status: "failed",
            error: "Unable to fetch the video asset.",
        })
    })

    it("gives a failed callback with no reason a stated one", () => {
        expect(shotstackCompletionOf({ ...SHOTSTACK_WEBHOOK_FAILED, error: null })).toMatchObject({ status: "failed", error: "Shotstack did not say why the render failed." })
    })

    it.each([
        ["a state that is not an end", { ...SHOTSTACK_WEBHOOK_DONE, status: "rendering" }],
        ["a done callback with no address", { ...SHOTSTACK_WEBHOOK_DONE, url: null }],
        ["a done callback with a plain http address", { ...SHOTSTACK_WEBHOOK_DONE, url: "http://cdn.test/a.mp4" }],
        ["another action", { ...SHOTSTACK_WEBHOOK_DONE, action: "copy" }],
        ["another type", { ...SHOTSTACK_WEBHOOK_DONE, type: "serve" }],
        ["no id", { ...SHOTSTACK_WEBHOOK_DONE, id: "" }],
        ["a list", []],
        ["text", "done"],
        ["nothing", null],
    ])("reports nothing for %s", (_name, body) => {
        expect(shotstackCompletionOf(body)).toBeNull()
    })

    it("declares an unsigned webhook", () => {
        expect(SHOTSTACK_WEBHOOK).toEqual({ signatureHeader: null, timestampHeader: null })
    })
})
})
