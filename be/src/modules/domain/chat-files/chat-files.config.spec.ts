import { resolve } from "node:path"
import { EnvSource } from "@modules/platform/config"
import { parseChatFilesImportRoot } from "./chat-files.config"

describe("parseChatFilesImportRoot", () => {
    it("is the .starciwork folder of the directory the app runs in unless the environment names another", () => {
        expect(parseChatFilesImportRoot(new EnvSource({}))).toBe(resolve(".starciwork"))
        expect(parseChatFilesImportRoot(new EnvSource({ INBOUND_IMPORT_ROOT: "imports/receipts" }))).toBe(
            resolve("imports/receipts"),
        )
    })
})
