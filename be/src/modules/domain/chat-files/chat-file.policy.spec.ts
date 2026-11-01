import { Test } from "@nestjs/testing"
import {
    CHAT_FILE_MAX_BYTES,
    chatFileNameOf,
    chatFilePathOf,
    isAcceptedChatFile,
    isChatFilePath,
    sniffChatFile,
} from "./chat-file.policy"

const POLICY = Symbol("chat-file.policy")

/** The policy, built the way Nest builds a provider. */
const build = async () => {
    const moduleRef = await Test.createTestingModule({
        providers: [
            {
                provide: POLICY,
                useValue: { chatFileNameOf, chatFilePathOf, isAcceptedChatFile, isChatFilePath, sniffChatFile },
            },
        ],
    }).compile()
    return moduleRef.get<typeof import("./chat-file.policy")>(POLICY)
}

const SCOPE = { workspaceId: "ws-1", conversationId: "conv-1" }
const OBJECT_ID = "0f8fad5b-d9cb-469f-a165-70867728950e"

describe("isAcceptedChatFile", () => {
    it.each(["image/jpeg", "image/png", "image/webp", "application/pdf"])(
        "accepts %s within the limit",
        async (contentType) => {
            expect((await build()).isAcceptedChatFile({ contentType, sizeBytes: CHAT_FILE_MAX_BYTES })).toBe(true)
        },
    )

    it.each([
        ["over the limit", { contentType: "image/png", sizeBytes: CHAT_FILE_MAX_BYTES + 1 }],
        ["empty", { contentType: "image/png", sizeBytes: 0 }],
        ["a type the route cannot read", { contentType: "application/zip", sizeBytes: 10 }],
    ])("refuses a file %s", async (_case, file) => {
        expect((await build()).isAcceptedChatFile(file)).toBe(false)
    })
})

describe("chat file paths", () => {
    it("keeps a file inside the folder of its workspace and conversation", async () => {
        expect((await build()).chatFilePathOf(SCOPE, OBJECT_ID, "application/pdf")).toBe(
            `ws-1/chat/conv-1/${OBJECT_ID}.pdf`,
        )
    })

    it("accepts the path it issued", async () => {
        expect((await build()).isChatFilePath(SCOPE, chatFilePathOf(SCOPE, OBJECT_ID, "image/png"))).toBe(true)
    })

    it.each([
        ["another workspace", `ws-2/chat/conv-1/${OBJECT_ID}.png`],
        ["another conversation", `ws-1/chat/conv-2/${OBJECT_ID}.png`],
        ["a traversal", `ws-1/chat/conv-1/../${OBJECT_ID}.png`],
        ["another extension", `ws-1/chat/conv-1/${OBJECT_ID}.svg`],
    ])("refuses %s", async (_case, path) => {
        expect((await build()).isChatFilePath(SCOPE, path)).toBe(false)
    })
})

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
})
