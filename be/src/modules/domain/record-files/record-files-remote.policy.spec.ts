import { Test } from "@nestjs/testing"
import { FILE_REMOTE_URL_MAX } from "@nivo-lite/agent-sdk/entity"
import { RecordFilesErrorCode } from "./errors/record-files.error"
import { remoteUrlOf } from "./record-files-remote.policy"

const SUBJECT = Symbol("record-files-remote.policy")

const build = async () => {
    const moduleRef = await Test.createTestingModule({
        providers: [{ provide: SUBJECT, useValue: { remoteUrlOf } }],
    }).compile()
    return moduleRef.get<typeof import("./record-files-remote.policy")>(SUBJECT)
}

describe("remoteUrlOf", () => {
    it("takes a public https address with a well-formed host", async () => {
        const subject = await build()
        expect(subject.remoteUrlOf("https://cdn.provider.test/out/clip.mp4?sig=abc").hostname).toBe("cdn.provider.test")
        expect(subject.remoteUrlOf("https://93.184.216.34/a.png").hostname).toBe("93.184.216.34")
        expect(subject.remoteUrlOf("https://[2606:2800:220:1:248:1893:25c8:1946]/a.png").protocol).toBe("https:")
    })

    it("refuses every other scheme, credentials in the address, a malformed host, an address too long, and a text that is no address", async () => {
        const subject = await build()
        const invalid = [
            "http://cdn.provider.test/a.png",
            "ftp://cdn.provider.test/a.png",
            "file:///etc/passwd",
            "data:text/plain;base64,AAAA",
            "https://user:pw@cdn.provider.test/a.png",
            "https://user@cdn.provider.test/a.png",
            "https://bad host.test/a.png",
            `https://cdn.provider.test/${"a".repeat(FILE_REMOTE_URL_MAX)}`,
            "not an address",
            "",
        ]
        for (const raw of invalid) {
            expect(() => subject.remoteUrlOf(raw)).toThrow(RecordFilesErrorCode.UrlInvalid)
        }
    })
})
