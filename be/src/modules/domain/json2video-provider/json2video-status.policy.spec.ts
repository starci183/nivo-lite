import { Test } from "@nestjs/testing"
import { mock } from "@starci/jest-preset"
import {
    J2V_HOOK_FAILURE,
    J2V_HOOK_SUCCESS,
    J2V_HOOK_TEST,
    J2V_PROJECT,
    J2V_STATUS_DONE,
    J2V_STATUS_ERROR,
    J2V_STATUS_PENDING,
    J2V_STATUS_RUNNING,
    J2V_URL,
} from "../../../tests/fixtures/builders/json2video.builder"
import { json2videoMovieOf } from "@modules/integrations/json2video"
import { JSON2VIDEO_NO_URL_WORDS as JSON2VIDEO_NO_URL_WORDSSubject, JSON2VIDEO_TIMEOUT_MS as JSON2VIDEO_TIMEOUT_MSSubject, JSON2VIDEO_TIMEOUT_WORDS as JSON2VIDEO_TIMEOUT_WORDSSubject, completionOf as completionOfSubject, renderStateOf as renderStateOfSubject } from "./json2video-status.policy"


const SUBJECT = Symbol("json2video-status.policy")

const build = async (): Promise<{ JSON2VIDEO_NO_URL_WORDS: typeof JSON2VIDEO_NO_URL_WORDSSubject; JSON2VIDEO_TIMEOUT_MS: typeof JSON2VIDEO_TIMEOUT_MSSubject; JSON2VIDEO_TIMEOUT_WORDS: typeof JSON2VIDEO_TIMEOUT_WORDSSubject; completionOf: typeof completionOfSubject; renderStateOf: typeof renderStateOfSubject }> => {
    const moduleRef = await Test.createTestingModule({
        providers: [{ provide: SUBJECT, useValue: mock<{ JSON2VIDEO_NO_URL_WORDS: typeof JSON2VIDEO_NO_URL_WORDSSubject; JSON2VIDEO_TIMEOUT_MS: typeof JSON2VIDEO_TIMEOUT_MSSubject; JSON2VIDEO_TIMEOUT_WORDS: typeof JSON2VIDEO_TIMEOUT_WORDSSubject; completionOf: typeof completionOfSubject; renderStateOf: typeof renderStateOfSubject }>({ JSON2VIDEO_NO_URL_WORDS: JSON2VIDEO_NO_URL_WORDSSubject, JSON2VIDEO_TIMEOUT_MS: JSON2VIDEO_TIMEOUT_MSSubject, JSON2VIDEO_TIMEOUT_WORDS: JSON2VIDEO_TIMEOUT_WORDSSubject, completionOf: completionOfSubject, renderStateOf: renderStateOfSubject }) }],
    }).compile()
    return moduleRef.get<{ JSON2VIDEO_NO_URL_WORDS: typeof JSON2VIDEO_NO_URL_WORDSSubject; JSON2VIDEO_TIMEOUT_MS: typeof JSON2VIDEO_TIMEOUT_MSSubject; JSON2VIDEO_TIMEOUT_WORDS: typeof JSON2VIDEO_TIMEOUT_WORDSSubject; completionOf: typeof completionOfSubject; renderStateOf: typeof renderStateOfSubject }>(SUBJECT)
}

const CREATED = Date.parse("2026-05-12T07:41:41.946Z")
const SOON = new Date(CREATED + 60_000)

describe("renderStateOf (docs status words)", () => {
    let JSON2VIDEO_NO_URL_WORDS: typeof JSON2VIDEO_NO_URL_WORDSSubject
    let JSON2VIDEO_TIMEOUT_MS: typeof JSON2VIDEO_TIMEOUT_MSSubject
    let JSON2VIDEO_TIMEOUT_WORDS: typeof JSON2VIDEO_TIMEOUT_WORDSSubject
    let renderStateOf: typeof renderStateOfSubject

    beforeAll(async () => {
        ;({ JSON2VIDEO_NO_URL_WORDS, JSON2VIDEO_TIMEOUT_MS, JSON2VIDEO_TIMEOUT_WORDS, renderStateOf } = await build())
    })

    it.each([
        ["pending", J2V_STATUS_PENDING, { renderId: J2V_PROJECT, status: "queued" }],
        ["running", J2V_STATUS_RUNNING, { renderId: J2V_PROJECT, status: "rendering" }],
        ["done", J2V_STATUS_DONE, { renderId: J2V_PROJECT, status: "done", outputUrl: J2V_URL }],
        ["error", J2V_STATUS_ERROR, { renderId: J2V_PROJECT, status: "failed", error: "Scene #1, element #2: …" }],
    ])("maps %s", (_name, body, expected) => {
        expect(renderStateOf(json2videoMovieOf(body), SOON)).toEqual(expected)
    })

    it("fails a render still running more than 15 minutes after it was created (the client-computed timeout)", () => {
        const movie = json2videoMovieOf(J2V_STATUS_RUNNING)

        expect(renderStateOf(movie, new Date(CREATED + JSON2VIDEO_TIMEOUT_MS))).toMatchObject({ status: "rendering" })
        expect(renderStateOf(movie, new Date(CREATED + JSON2VIDEO_TIMEOUT_MS + 1))).toEqual({
            renderId: J2V_PROJECT,
            status: "failed",
            error: JSON2VIDEO_TIMEOUT_WORDS,
        })
    })

    it("fails a `timeout` word the same way", () => {
        const movie = { ...json2videoMovieOf(J2V_STATUS_RUNNING), status: "timeout" as const }

        expect(renderStateOf(movie, SOON)).toMatchObject({ status: "failed", error: JSON2VIDEO_TIMEOUT_WORDS })
    })

    it("fails a done render with no https video address", () => {
        const movie = { ...json2videoMovieOf(J2V_STATUS_DONE), url: null }

        expect(renderStateOf(movie, SOON)).toEqual({ renderId: J2V_PROJECT, status: "failed", error: JSON2VIDEO_NO_URL_WORDS })
        expect(renderStateOf({ ...movie, url: "http://assets.json2video.com/x.mp4" }, SOON)).toMatchObject({ status: "failed" })
    })

    it("fails an error with no message without inventing words", () => {
        const movie = { ...json2videoMovieOf(J2V_STATUS_ERROR), message: "" }

        expect(renderStateOf(movie, SOON)).toEqual({ renderId: J2V_PROJECT, status: "failed" })
    })
})

describe("completionOf (docs webhook bodies)", () => {
    let completionOf: typeof completionOfSubject

    beforeAll(async () => {
        ;({ completionOf } = await build())
    })

    it("maps the success payload to done with the https video address", () => {
        expect(completionOf(J2V_HOOK_SUCCESS)).toEqual({
            renderId: J2V_PROJECT,
            status: "done",
            outputUrl: "https://assets.json2video.com/clients/xxxxxxxx/renders/yourmovie.mp4",
        })
    })

    it("maps the failure payload to failed with the provider's error", () => {
        expect(completionOf(J2V_HOOK_FAILURE)).toEqual({ renderId: J2V_PROJECT, status: "failed", error: "Scene #1, element #2: …" })
    })

    it("maps a failure without words to failed without an error", () => {
        expect(completionOf({ success: false, project: J2V_PROJECT })).toEqual({ renderId: J2V_PROJECT, status: "failed" })
    })

    it.each([
        ["the dashboard test ping", J2V_HOOK_TEST],
        ["a success without a video address", { ...J2V_HOOK_SUCCESS, url: null }],
        ["a success with a plain http address", { ...J2V_HOOK_SUCCESS, url: "http://assets.json2video.com/x.mp4" }],
        ["a body without a project", { success: true, url: J2V_HOOK_SUCCESS.url }],
        ["a body with no success member", { project: J2V_PROJECT, url: J2V_HOOK_SUCCESS.url }],
        ["a form-encoded string success", { ...J2V_HOOK_SUCCESS, success: "true" }],
        ["null", null],
        ["a string", "x"],
        ["an array", []],
    ])("reports no finished render for %s", (_name, body) => {
        expect(completionOf(body)).toBeNull()
    })
})
