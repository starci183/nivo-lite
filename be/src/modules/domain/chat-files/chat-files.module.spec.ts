import { InboundFilesService } from "./inbound-files.service"
import { ChatFileReadsService } from "./chat-file-reads.service"
import { CHAT_FILES_ASSETS, CHAT_FILES_IMPORT_ROOT, CHAT_FILES_READER, CHAT_FILES_RESOLVER, CHAT_FILES_STORAGE } from "./chat-files.decorators"
import { ChatFilesModule } from "./chat-files.module"
import { ChatFilesService } from "./chat-files.service"
import { NodeInboundFileReader } from "./inbound-file.reader"
import { NodeHostResolver } from "./inbound-file.resolver"

describe("ChatFilesModule", () => {
    const registered = ChatFilesModule.register({ storage: "OBJECTS", assets: "ASSETS", importRoot: "/work/.starciwork" })

    it("binds the stores the app root names, the import folder and the reader of local files", () => {
        expect(registered.providers).toEqual(
            expect.arrayContaining([
                { provide: CHAT_FILES_STORAGE, useExisting: "OBJECTS" },
                { provide: CHAT_FILES_ASSETS, useExisting: "ASSETS" },
                { provide: CHAT_FILES_IMPORT_ROOT, useValue: "/work/.starciwork" },
                { provide: CHAT_FILES_READER, useClass: NodeInboundFileReader },
                { provide: CHAT_FILES_RESOLVER, useClass: NodeHostResolver },
            ]),
        )
    })

    it("provides and exports the files of a conversation and the files a channel brings in", () => {
        const services = [ChatFilesService, ChatFileReadsService, InboundFilesService]

        expect(registered.providers).toEqual(expect.arrayContaining(services))
        expect(registered.exports).toEqual(services)
    })
})
