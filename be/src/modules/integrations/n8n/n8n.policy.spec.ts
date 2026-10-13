import { N8nErrorCode } from "./errors/n8n.error"
import { assertAllowedTarget, assertEventName, isTransientStatus, signBody, workspaceKey } from "./n8n.policy"

describe("assertAllowedTarget", () => {
    const resolve = jest.fn<Promise<ReadonlyArray<string>>, [string]>()

    beforeEach(() => {
        resolve.mockReset()
        resolve.mockResolvedValue(["8.8.8.8"])
    })

    it("accepts a public https host that resolves to public addresses", async () => {
        await expect(assertAllowedTarget("https://hooks.example.com/a", [], resolve)).resolves.toEqual(
            new URL("https://hooks.example.com/a"),
        )
        expect(resolve).toHaveBeenCalledWith("hooks.example.com")
    })

    it("accepts an allow-listed private host without resolving it", async () => {
        await expect(assertAllowedTarget("http://n8n:5678/webhook/x", ["n8n"], resolve)).resolves.toEqual(
            new URL("http://n8n:5678/webhook/x"),
        )
        expect(resolve).not.toHaveBeenCalled()
    })

    it("checks an ip literal itself, with the brackets of an ipv6 host removed", async () => {
        await expect(assertAllowedTarget("http://8.8.8.8/x", [], resolve)).resolves.toBeInstanceOf(URL)
        await expect(assertAllowedTarget("http://[::1]/x", [], resolve)).rejects.toMatchObject({
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
        await expect(assertAllowedTarget(target, [], resolve)).rejects.toMatchObject({
            code: N8nErrorCode.TargetRefused,
            params: { reason },
        })
    })

    it("refuses a host that resolves to a private address or to nothing", async () => {
        resolve.mockResolvedValueOnce(["8.8.8.8", "10.0.0.5"])
        await expect(assertAllowedTarget("https://hooks.example.com/a", [], resolve)).rejects.toMatchObject({
            params: { reason: "private-address" },
        })
        resolve.mockResolvedValueOnce([])
        await expect(assertAllowedTarget("https://hooks.example.com/a", [], resolve)).rejects.toMatchObject({
            params: { reason: "private-address" },
        })
    })
})

describe("assertEventName", () => {
    it("returns a dotted identifier", () => {
        expect(assertEventName("pipeline.email-daily-report")).toBe("pipeline.email-daily-report")
    })

    it.each(["", "1lead", "lead created", `a${"b".repeat(80)}`])("refuses %p", (event) => {
        expect(() => assertEventName(event)).toThrow(expect.objectContaining({ code: N8nErrorCode.EventInvalid }))
    })
})

describe("signing", () => {
    it("derives one key per workspace and signs the timestamp and the raw body with it", () => {
        const keyA = workspaceKey("secret", "workspace-a")
        const keyB = workspaceKey("secret", "workspace-b")
        expect(keyA).toMatch(/^[0-9a-f]{64}$/u)
        expect(keyA).not.toBe(keyB)
        expect(signBody(keyA, "1700000000000", "{}")).toMatch(/^[0-9a-f]{64}$/u)
        expect(signBody(keyA, "1700000000000", "{}")).toBe(signBody(keyA, "1700000000000", "{}"))
        expect(signBody(keyA, "1700000000001", "{}")).not.toBe(signBody(keyA, "1700000000000", "{}"))
    })
})

describe("isTransientStatus", () => {
    it.each([500, 502, 503, 408, 429])("retries %i", (status) => {
        expect(isTransientStatus(status)).toBe(true)
    })

    it.each([200, 301, 400, 401, 404])("does not retry %i", (status) => {
        expect(isTransientStatus(status)).toBe(false)
    })
})
