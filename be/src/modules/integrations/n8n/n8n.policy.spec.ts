import { Test } from "@nestjs/testing"
import { N8nErrorCode } from "./errors/n8n.error"
import {
    assertAllowedTarget as assertAllowedTargetImplementation,
    assertEventName as assertEventNameImplementation,
    isTransientStatus as isTransientStatusImplementation,
    signBody as signBodyImplementation,
    workspaceKey as workspaceKeyImplementation,
} from "./n8n.policy"

/** A partial-object matcher, typed `unknown` so it flows into any slot. */
const objectLike = (shape: Record<string, unknown>): unknown => expect.objectContaining(shape)

/** What `run` throws, read as `unknown`; the matcher then judges its fields. */
const thrownBy = (run: () => unknown): unknown => {
    try {
        run()
    } catch (error) {
        return error
    }
    return undefined
}

const SUBJECT = Symbol("subject")
type Subject = {
    assertAllowedTarget: typeof assertAllowedTargetImplementation
    assertEventName: typeof assertEventNameImplementation
    isTransientStatus: typeof isTransientStatusImplementation
    signBody: typeof signBodyImplementation
    workspaceKey: typeof workspaceKeyImplementation
}

const buildSubject = async () => {
    const moduleRef = await Test.createTestingModule({
        providers: [
            {
                provide: SUBJECT,
                useValue: {
                    assertAllowedTarget: assertAllowedTargetImplementation,
                    assertEventName: assertEventNameImplementation,
                    isTransientStatus: isTransientStatusImplementation,
                    signBody: signBodyImplementation,
                    workspaceKey: workspaceKeyImplementation,
                },
            },
        ],
    }).compile()
    return moduleRef.get<Subject>(SUBJECT)
}

describe("assertAllowedTarget", () => {
    const resolve = jest.fn<Promise<ReadonlyArray<string>>, [string]>()

    beforeEach(() => {
        resolve.mockReset()
        resolve.mockResolvedValue(["8.8.8.8"])
    })

    it("accepts a public https host that resolves to public addresses", async () => {
        const subject = await buildSubject()

        await expect(subject.assertAllowedTarget("https://hooks.example.com/a", [], resolve)).resolves.toEqual(
            new URL("https://hooks.example.com/a"),
        )
        expect(resolve).toHaveBeenCalledWith("hooks.example.com")
    })

    it("accepts an allow-listed private host without resolving it", async () => {
        const subject = await buildSubject()

        await expect(subject.assertAllowedTarget("http://n8n:5678/webhook/x", ["n8n"], resolve)).resolves.toEqual(
            new URL("http://n8n:5678/webhook/x"),
        )
        expect(resolve).not.toHaveBeenCalled()
    })

    it("checks an ip literal itself, with the brackets of an ipv6 host removed", async () => {
        const subject = await buildSubject()

        await expect(subject.assertAllowedTarget("http://8.8.8.8/x", [], resolve)).resolves.toBeInstanceOf(URL)
        await expect(subject.assertAllowedTarget("http://[::1]/x", [], resolve)).rejects.toMatchObject({
            code: N8nErrorCode.TargetRefused,
            params: { reason: "private-address" },
        })
        expect(resolve).not.toHaveBeenCalled()
    })

    it.each([
        ["not a url", "not-a-url"],
        ["ftp://hooks.example.com/a", "protocol"],
        ["https://user:secret@hooks.example.com/a", "credentials"],
        ["https://:secret@hooks.example.com/a", "credentials"],
    ])("refuses %s", async (target, reason) => {
        const subject = await buildSubject()

        await expect(subject.assertAllowedTarget(target, [], resolve)).rejects.toMatchObject({
            code: N8nErrorCode.TargetRefused,
            params: { reason },
        })
    })

    it("refuses a host that resolves to a private address or to nothing", async () => {
        const subject = await buildSubject()

        resolve.mockResolvedValueOnce(["8.8.8.8", "10.0.0.5"])
        await expect(subject.assertAllowedTarget("https://hooks.example.com/a", [], resolve)).rejects.toMatchObject({
            params: { reason: "private-address" },
        })
        resolve.mockResolvedValueOnce([])
        await expect(subject.assertAllowedTarget("https://hooks.example.com/a", [], resolve)).rejects.toMatchObject({
            params: { reason: "private-address" },
        })
    })
})

describe("assertEventName", () => {
    it("returns a dotted identifier", async () => {
        const subject = await buildSubject()

        expect(subject.assertEventName("pipeline.email-daily-report")).toBe("pipeline.email-daily-report")
    })

    it.each(["", "1lead", "lead created", `a${"b".repeat(80)}`])("refuses %p", async (event) => {
        const subject = await buildSubject()

        expect(thrownBy(() => subject.assertEventName(event))).toEqual(objectLike({ code: N8nErrorCode.EventInvalid }))
    })
})

describe("signing", () => {
    it("derives one key per workspace and signs the timestamp and the raw body with it", async () => {
        const subject = await buildSubject()

        const keyA = subject.workspaceKey("secret", "workspace-a")
        const keyB = subject.workspaceKey("secret", "workspace-b")
        expect(keyA).toMatch(/^[0-9a-f]{64}$/u)
        expect(keyA).not.toBe(keyB)
        expect(subject.signBody(keyA, "1700000000000", "{}")).toMatch(/^[0-9a-f]{64}$/u)
        expect(subject.signBody(keyA, "1700000000000", "{}")).toBe(subject.signBody(keyA, "1700000000000", "{}"))
        expect(subject.signBody(keyA, "1700000000001", "{}")).not.toBe(subject.signBody(keyA, "1700000000000", "{}"))
    })
})

describe("isTransientStatus", () => {
    it.each([500, 502, 503, 408, 429])("retries %i", async (status) => {
        const subject = await buildSubject()

        expect(subject.isTransientStatus(status)).toBe(true)
    })

    it.each([200, 301, 400, 401, 404])("does not retry %i", async (status) => {
        const subject = await buildSubject()

        expect(subject.isTransientStatus(status)).toBe(false)
    })
})
