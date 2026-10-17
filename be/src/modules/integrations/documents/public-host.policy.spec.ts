import { Test } from "@nestjs/testing"
import { isPublicHost } from "./public-host.policy"

const SUBJECT = Symbol("public-host.policy")

const build = async () => {
    const moduleRef = await Test.createTestingModule({
        providers: [{ provide: SUBJECT, useValue: { isPublicHost } }],
    }).compile()
    return moduleRef.get<typeof import("./public-host.policy")>(SUBJECT)
}

describe("isPublicHost", () => {
    it.each([
        "localhost",
        "0.0.0.0",
        "::1",
        "[::1]",
        "printer.local",
        "db.internal",
        "app.localhost",
        "127.0.0.1",
        "10.1.2.3",
        "192.168.0.9",
        "169.254.169.254",
        "172.16.0.1",
        "172.31.255.1",
    ])("refuses %s", async (host) => {
        const subject = await build()

        expect(subject.isPublicHost(host)).toBe(false)
    })

    it.each(["example.com", "docs.google.com", "8.8.8.8", "172.32.0.1", "172.15.0.1"])("accepts %s", async (host) => {
        const subject = await build()

        expect(subject.isPublicHost(host)).toBe(true)
    })
})
