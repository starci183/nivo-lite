import { Test } from "@nestjs/testing"
import { mock } from "@starci/jest-preset"
import { MESSAGE_CATALOG } from "@modules/platform/i18n"
import type { MessageCatalog } from "@modules/platform/i18n"
import { ModuleProfilesService } from "./module-profiles.service"

const build = async (): Promise<ModuleProfilesService> => {
    const catalog = mock<MessageCatalog>({ get: jest.fn((key: string) => `<${key}>`) })
    const moduleRef = await Test.createTestingModule({
        providers: [ModuleProfilesService, { provide: MESSAGE_CATALOG, useValue: catalog }],
    }).compile()
    return moduleRef.get(ModuleProfilesService)
}

describe("ModuleProfilesService", () => {
    it("holds the chatbot to the base contract and adds the booking and loyalty parts", async () => {
        const profiles = await build()
        expect(profiles.replyContractOf("chatbot", "BASE")).toBe("BASE")
        expect(profiles.replyContractOf("booking", "BASE")).toBe("BASE\n<bundle.bookingAddendum>")
        expect(profiles.replyContractOf("loyalty", "BASE")).toBe("BASE\n<bundle.loyaltyContract>")
    })

    it("gives hiring its own contract and an internal module none", async () => {
        const profiles = await build()
        expect(profiles.replyContractOf("hiring", "BASE")).toBe("<bundle.hiringContract>")
        expect(profiles.replyContractOf("accounting", "BASE")).toBeNull()
    })

    it("embeds the hiring clause on its own line and the hiring shape", async () => {
        const profiles = await build()
        expect(profiles.applicationClause()).toBe("<hiring.chat.clause>\n")
        expect(profiles.applicationShape()).toBe("<hiring.chat.shape>")
        expect(profiles.knowledgeFolderOf("not-a-module")).toBeNull()
    })
})
