import { Test } from "@nestjs/testing"
import { mock } from "@starci/jest-preset"
import { ChatTurnModule, ChatTurnQueue } from "@modules/queues/chat-turn"
import { ChatTurnExtensionsService } from "./chat-turn-extensions.service"
import { ChatTurnService } from "./chat-turn.service"
import { CHAT_TURN_EXTENSIONS } from "./conversations.decorators"
import { ConfigurableModuleClass } from "./conversations.module-definition"
import { ConversationsModule } from "./conversations.module"
import { ConversationsService } from "./conversations.service"
import { CONVERSATIONS_ERROR_KINDS } from "./errors/conversations.error"
import * as conversations from "./index"
import { CONVERSATIONS_MESSAGES } from "./messages/conversations.messages"
import { readTelegramUpdate } from "./telegram-update.policy"
import { readZaloEvent } from "./zalo-event.policy"

describe("ConversationsModule", () => {
    it.each([false, true])("registers its services and extension alias with isGlobal=%p", async (isGlobal) => {
        const intake = mock<ConversationsService>()
        const turns = mock<ChatTurnService>()
        const queue = mock<ChatTurnQueue>()
        const base = ConfigurableModuleClass.register({ isGlobal })
        const registration = ConversationsModule.register({ isGlobal })

        expect(registration).toEqual({
            ...base,
            module: ConversationsModule,
            imports: [...(base.imports ?? []), ChatTurnModule],
            providers: [
                ...(base.providers ?? []),
                ChatTurnExtensionsService,
                ConversationsService,
                ChatTurnService,
                { provide: CHAT_TURN_EXTENSIONS, useExisting: ChatTurnExtensionsService },
            ],
            exports: [CHAT_TURN_EXTENSIONS, ConversationsService, ChatTurnService],
        })
        expect(registration.global).toBe(isGlobal)

        const moduleRef = await Test.createTestingModule({ imports: [registration] })
            .overrideProvider(ConversationsService)
            .useValue(intake)
            .overrideProvider(ChatTurnService)
            .useValue(turns)
            .overrideProvider(ChatTurnQueue)
            .useValue(queue)
            .compile()

        expect(moduleRef.get(ConversationsService)).toBe(intake)
        expect(moduleRef.get(ChatTurnService)).toBe(turns)
        expect(moduleRef.get(ChatTurnQueue)).toBe(queue)
        expect(moduleRef.get(CHAT_TURN_EXTENSIONS)).toBe(moduleRef.get(ChatTurnExtensionsService))
        await moduleRef.close()
    })

    it("defaults to a local registration", () => {
        expect(ConversationsModule.register({}).global).toBe(false)
    })

    it("preserves the configurable base imports when the base supplies no providers", () => {
        const register = jest
            .spyOn(ConfigurableModuleClass, "register")
            .mockReturnValueOnce({ module: ConversationsModule, imports: [ChatTurnModule] })

        try {
            const registration = ConversationsModule.register({})

            expect(register).toHaveBeenCalledWith({})
            expect(registration).toEqual({
                module: ConversationsModule,
                imports: [ChatTurnModule, ChatTurnModule],
                providers: [
                    ChatTurnExtensionsService,
                    ConversationsService,
                    ChatTurnService,
                    { provide: CHAT_TURN_EXTENSIONS, useExisting: ChatTurnExtensionsService },
                ],
                exports: [CHAT_TURN_EXTENSIONS, ConversationsService, ChatTurnService],
            })
        } finally {
            register.mockRestore()
        }
    })

    it("exports its intake, turns, module, message bundle and inbound readers", () => {
        expect(conversations).toEqual({
            ChatTurnService,
            ConversationsModule,
            ConversationsService,
            CONVERSATIONS_ERROR_KINDS,
            CONVERSATIONS_MESSAGES,
            readTelegramUpdate,
            readZaloEvent,
        })
        expect(Object.keys(CONVERSATIONS_MESSAGES.vi).sort()).toEqual(Object.keys(CONVERSATIONS_MESSAGES.en).sort())
        expect(CONVERSATIONS_MESSAGES.en["conversations.facebookGuest"]).toBe("Facebook customer")
        expect(CONVERSATIONS_MESSAGES.en["conversations.instagramGuest"]).toBe("Instagram customer")
    })

    it.each(["./conversations.contracts", "./conversations.options", "./persistence/conversations.rows"])(
        "keeps %s as a type-only module",
        (moduleName) => {
            expect(jest.requireActual<object>(moduleName)).toEqual({})
        },
    )
})
