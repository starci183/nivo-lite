import { Test } from "@nestjs/testing"
import { DomainError } from "@modules/platform/errors"
import { QueueError, QueueErrorCode } from "./errors/queue.error"
import { classifyFailure } from "./queue-failure.policy"

class Coded extends DomainError<string> {}

const SUBJECT = Symbol("queue-failure.policy")

const buildSubject = async () => {
    const moduleRef = await Test.createTestingModule({
        providers: [{ provide: SUBJECT, useValue: { classifyFailure } }],
    }).compile()
    return moduleRef.get<typeof import("./queue-failure.policy")>(SUBJECT)
}

describe("classifyFailure", () => {
    it.each(["ECONNRESET", "ETIMEDOUT", "ECONNREFUSED", "EAI_AGAIN", "40001", "40P01"])(
        "calls %s transient",
        async (code) => {
            const subject = await buildSubject()

            expect(subject.classifyFailure(Object.assign(new Error("x"), { code }))).toBe("transient")
        },
    )

    it("calls a server failure and the two asking statuses transient", async () => {
        const subject = await buildSubject()

        expect(subject.classifyFailure({ status: 503 })).toBe("transient")
        expect(subject.classifyFailure({ statusCode: 429 })).toBe("transient")
        expect(subject.classifyFailure({ status: 408 })).toBe("transient")
        expect(subject.classifyFailure({ status: 400 })).toBe("code")
    })

    it("reads the code of a capability error and the cause under it", async () => {
        const subject = await buildSubject()
        const wrapped = new Error("wrapped", { cause: Object.assign(new Error("x"), { code: "ECONNRESET" }) })

        expect(subject.classifyFailure(new Coded({ code: "HTTP_TIMEOUT" }))).toBe("transient")
        expect(subject.classifyFailure(new Coded({ code: "QUEUE_REDIS_DEADLINE" }))).toBe("transient")
        expect(subject.classifyFailure(new Coded({ code: "SALES_NOT_FOUND" }))).toBe("input")
        expect(subject.classifyFailure(wrapped)).toBe("transient")
    })

    it("calls a capability error input, or config when its code names a setting or a connection", async () => {
        const subject = await buildSubject()

        expect(subject.classifyFailure(new Coded({ code: "ZALO_CONNECTION_MISSING" }))).toBe("config")
        expect(subject.classifyFailure(new Coded({ code: "ZALO_TOKEN_REVOKED" }))).toBe("input")
        expect(subject.classifyFailure(new Coded({ code: "BILLING_CONFIG_INVALID" }))).toBe("config")
        expect(subject.classifyFailure(new Coded({ code: "ZALO_X_CONNECTION_GONE" }))).toBe("config")
    })

    it("keeps the class a failure was thrown with", async () => {
        const subject = await buildSubject()

        expect(
            subject.classifyFailure(
                new QueueError({ code: QueueErrorCode.FlowFailure, params: { failureClass: "input" } }),
            ),
        ).toBe("input")
        const unknown = new QueueError({ code: QueueErrorCode.FlowFailure, params: { failureClass: "other" } })
        expect(subject.classifyFailure(unknown)).toBe("input")
        expect(
            subject.classifyFailure(
                new Error("outer", {
                    cause: new QueueError({ code: QueueErrorCode.FlowFailure, params: { failureClass: "config" } }),
                }),
            ),
        ).toBe("config")
    })

    it("calls anything else code, and stops at a cycle or a non-object", async () => {
        const subject = await buildSubject()
        const loop = new Error("loop")
        loop.cause = loop

        expect(subject.classifyFailure(new Error("bug"))).toBe("code")
        expect(subject.classifyFailure("text")).toBe("code")
        expect(subject.classifyFailure({ code: 5 })).toBe("code")
        expect(subject.classifyFailure(loop)).toBe("code")
    })
})
