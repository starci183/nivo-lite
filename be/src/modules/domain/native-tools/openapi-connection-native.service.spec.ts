import { Test } from "@nestjs/testing"
import { mock } from "@starci/jest-preset"
import type { ContactsService, ConversationContactsService } from "@modules/domain/contacts"
import { conversationLinksOf } from "./openapi-connection-native.service"

const SUBJECT = Symbol("openapi-connection-native.service")

const WORKSPACE = "11111111-1111-4111-8111-111111111111"
const ACCOUNT = "8f8f2c1e-0000-4000-8000-00000000c001"
const CONTACT = "8f8f2c1e-0000-4000-8000-00000000c003"

const build = async () => {
    const moduleRef = await Test.createTestingModule({
        providers: [{ provide: SUBJECT, useValue: mock<typeof import("./openapi-connection-native.service")>({ conversationLinksOf }) }],
    }).compile()
    const subject = moduleRef.get<typeof import("./openapi-connection-native.service")>(SUBJECT)
    const conversations = mock<Pick<ConversationContactsService, "contactOf">>()
    const contacts = mock<Pick<ContactsService, "externalOf">>()
    conversations.contactOf.mockResolvedValue(CONTACT)
    contacts.externalOf.mockResolvedValue("ACME")
    return { subject, conversations, contacts, port: subject.conversationLinksOf(conversations, contacts) }
}

describe("conversationLinksOf", () => {
    it("answers the outside identity a person linked to the conversation's contact on the account that serves the call", async () => {
        const { conversations, contacts, port } = await build()

        await expect(port?.customerOf(WORKSPACE, "conversation-1", ACCOUNT)).resolves.toBe("ACME")

        expect(conversations.contactOf).toHaveBeenCalledWith(WORKSPACE, "conversation-1")
        expect(contacts.externalOf).toHaveBeenCalledWith(WORKSPACE, CONTACT, ACCOUNT)
    })

    it("is null for a contact nobody linked on that account, and for a conversation no contact holds (no identity is read)", async () => {
        const unlinked = await build()
        const stray = await build()
        unlinked.contacts.externalOf.mockResolvedValue(null)
        stray.conversations.contactOf.mockResolvedValue(null)

        await expect(unlinked.port?.customerOf(WORKSPACE, "conversation-1", ACCOUNT)).resolves.toBeNull()
        await expect(stray.port?.customerOf(WORKSPACE, "conversation-2", ACCOUNT)).resolves.toBeNull()

        expect(stray.contacts.externalOf).not.toHaveBeenCalled()
    })

    it("binds nothing in an app that holds no contacts: the connector then refuses, fail closed", async () => {
        const { subject, conversations, contacts } = await build()

        expect(subject.conversationLinksOf(undefined, contacts)).toBeUndefined()
        expect(subject.conversationLinksOf(conversations, undefined)).toBeUndefined()
    })
})
