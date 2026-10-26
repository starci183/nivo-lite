import { Test } from "@nestjs/testing"
import { Secret } from "@modules/platform/config"
import { listenUrlOf, withConnection } from "./realtime.policy"

const SUBJECT: unique symbol = Symbol("realtime.policy")

const CONNECTION = Symbol("connection")
const url = new Secret("postgres://primary")

const buildSubject = async () => {
    const functions = { listenUrlOf, withConnection }
    const moduleRef = await Test.createTestingModule({
        providers: [{ provide: SUBJECT, useFactory: () => functions }],
    }).compile()
    return moduleRef.get<typeof functions>(SUBJECT)
}

describe("withConnection", () => {
    it("leaves the memory hub as it is: it has no connection to bind", async () => {
        const subject = await buildSubject()

        expect(subject.withConnection({ hub: "memory" }, CONNECTION, url)).toEqual({ hub: "memory" })
    })

    it("binds a shared hub to the connection the app composes and to that database's session-mode url", async () => {
        const subject = await buildSubject()

        expect(subject.withConnection({ hub: "postgres" }, CONNECTION, url)).toEqual({
            hub: "postgres",
            connection: CONNECTION,
            url,
        })
    })

    it("carries the dedicated url when one is declared", async () => {
        const subject = await buildSubject()
        const dedicated = new Secret("postgres://direct")

        expect(subject.withConnection({ hub: "postgres", listenUrl: dedicated }, CONNECTION, url)).toEqual({
            hub: "postgres",
            connection: CONNECTION,
            url,
            listenUrl: dedicated,
        })
    })

    it("listens on the dedicated url when there is one, else on the primary url", async () => {
        const subject = await buildSubject()
        const dedicated = new Secret("postgres://direct")

        expect(subject.listenUrlOf({ hub: "postgres", connection: CONNECTION, url })).toBe(url)
        expect(subject.listenUrlOf({ hub: "postgres", connection: CONNECTION, url, listenUrl: dedicated })).toBe(
            dedicated,
        )
    })
})
