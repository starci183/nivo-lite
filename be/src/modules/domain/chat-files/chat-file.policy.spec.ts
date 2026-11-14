import { Test } from "@nestjs/testing"
import { chatFileNameOf, sniffChatFile } from "./chat-file.policy"

const POLICY = Symbol("chat-file.policy")

/** The policy, built the way Nest builds a provider. */
const build = async () => {
    const moduleRef = await Test.createTestingModule({
        providers: [
            {
                provide: POLICY,
                useValue: { chatFileNameOf, sniffChatFile },
            },
        ],
    }).compile()
    return moduleRef.get<typeof import("./chat-file.policy")>(POLICY)
}

describe("sniffChatFile", () => {
    it.each([
        ["image/png", [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]],
        ["image/jpeg", [0xff, 0xd8, 0xff, 0xe0]],
        ["application/pdf", [0x25, 0x50, 0x44, 0x46, 0x2d, 0x31]],
        ["image/webp", [0x52, 0x49, 0x46, 0x46, 0, 0, 0, 0, 0x57, 0x45, 0x42, 0x50]],
    ])("proves %s from the bytes", async (type, bytes) => {
        expect((await build()).sniffChatFile(Uint8Array.from(bytes))).toBe(type)
    })

    it("proves nothing from any other bytes", async () => {
        expect((await build()).sniffChatFile(Uint8Array.from([0x3c, 0x73, 0x76, 0x67]))).toBeNull()
    })
})

describe("chatFileNameOf", () => {
    it("keeps the last part of a name, without control characters", async () => {
        expect((await build()).chatFileNameOf("C:\\Users\\a/bien-lai\u0000.pdf", "x/y.pdf")).toBe("bien-lai.pdf")
    })

    it("falls back to the object name when nothing is left", async () => {
        expect((await build()).chatFileNameOf("   ", "x/y.pdf")).toBe("y.pdf")
    })

    it("keeps only the final 255 characters of the cleaned name", async () => {
        expect((await build()).chatFileNameOf(`discard-${"A".repeat(255)}`, "x/y.pdf")).toBe("A".repeat(255))
    })

    it("retains the empty object name when both supplied names are empty", async () => {
        expect((await build()).chatFileNameOf("", "")).toBe("")
    })
})
