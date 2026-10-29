import { Test } from "@nestjs/testing"
import { mock } from "@starci/jest-preset"
import type { Request, Response } from "express"
import passport from "passport"
import { PassportErrorCode } from "./errors/passport.error"
import { PASSPORT_OPTIONS } from "./passport.decorators"
import { PassportFlowsService } from "./passport-flows.service"

const SUBJECT = { userId: "u1", email: "an@example.test" }

/** The real passport machinery runs; only the strategies it dispatches to are stand-ins that answer the way the real ones do. */
const answering = {
    subject: (info?: object): passport.Strategy => ({
        name: "stand-in",
        authenticate() {
            this.success(SUBJECT, info)
        },
    }),
    refusal: (info: object): passport.Strategy => ({
        name: "stand-in",
        authenticate() {
            this.fail(info)
        },
    }),
    failure: (error: Error): passport.Strategy => ({
        name: "stand-in",
        authenticate() {
            this.error(error)
        },
    }),
    silent: (): passport.Strategy => ({ name: "stand-in", authenticate() {} }),
}

const build = async (google: object | null = null) => {
    const moduleRef = await Test.createTestingModule({
        providers: [PassportFlowsService, { provide: PASSPORT_OPTIONS, useValue: { google } }],
    }).compile()
    const res = mock<Response>()
    res.once.mockImplementation((_event, listener) => {
        listener()
        return res
    })
    return {
        flows: moduleRef.get(PassportFlowsService),
        exchange: { req: mock<Request>({ body: {}, query: {} }), res },
    }
}

afterEach(() => {
    passport.unuse("local")
    passport.unuse("google")
})

describe("PassportFlowsService / authenticateLocal", () => {
    it("runs the local strategy without a session and answers the person it established", async () => {
        const { flows, exchange } = await build()
        passport.use("local", answering.subject())

        await expect(flows.authenticateLocal(exchange)).resolves.toEqual(SUBJECT)
    })

    it("lets the refusal of the strategy through unchanged", async () => {
        const { flows, exchange } = await build()
        const refusal = new Error("wrong pair")
        passport.use("local", answering.failure(refusal))

        await expect(flows.authenticateLocal(exchange)).rejects.toBe(refusal)
    })

    it("refuses a request that established nobody (no pair posted)", async () => {
        const { flows, exchange } = await build()
        passport.use("local", answering.refusal({}))

        await expect(flows.authenticateLocal(exchange)).rejects.toMatchObject({
            code: PassportErrorCode.MissingCredentials,
        })
    })
})

describe("PassportFlowsService / google", () => {
    it("reports an absent Google client on both legs", async () => {
        const { flows, exchange } = await build()

        await expect(flows.beginGoogle(exchange)).rejects.toMatchObject({ code: PassportErrorCode.GoogleUnavailable })
        await expect(flows.completeGoogle(exchange)).rejects.toMatchObject({
            code: PassportErrorCode.GoogleUnavailable,
        })
    })

    it("answers the person and the landing path a finished round trip carries", async () => {
        const { flows, exchange } = await build({ clientId: "client" })
        passport.use("google", answering.subject({ state: { next: "/inbox" } }))

        await expect(flows.completeGoogle(exchange)).resolves.toEqual({ subject: SUBJECT, next: "/inbox" })
    })

    it("lands on the root when the state carries no path", async () => {
        const { flows, exchange } = await build({ clientId: "client" })
        passport.use("google", answering.subject())

        await expect(flows.completeGoogle(exchange)).resolves.toEqual({ subject: SUBJECT, next: "/" })
    })

    it("refuses a round trip whose state or code could not be proven", async () => {
        const { flows, exchange } = await build({ clientId: "client" })
        passport.use("google", answering.refusal({}))

        await expect(flows.completeGoogle(exchange)).rejects.toMatchObject({
            code: PassportErrorCode.GoogleStateInvalid,
        })
    })

    it("ends the first leg when the response finishes, and fails it when the strategy errors", async () => {
        const started = await build({ clientId: "client" })
        passport.use("google", answering.silent())
        await expect(started.flows.beginGoogle(started.exchange)).resolves.toBeUndefined()

        const failed = await build({ clientId: "client" })
        passport.use("google", answering.failure(new Error("consent")))
        failed.exchange.res.once.mockReset()
        await expect(failed.flows.beginGoogle(failed.exchange)).rejects.toThrow("consent")
    })
})
