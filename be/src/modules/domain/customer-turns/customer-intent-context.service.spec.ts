import { Test } from "@nestjs/testing"
import { mock } from "@starci/jest-preset"
import { runtimeTurn } from "@tests/fixtures/builders/customer-turn-runtime.builder"
import { KnowledgeRecallService } from "@modules/domain/agent-knowledge"
import { IntentTurnService } from "@modules/domain/agent-turns"
import type { IntentFileBundle } from "@modules/domain/agent-turns"
import { AuthorityService } from "@modules/domain/authority"
import { HiringPublicService } from "@modules/domain/hiring"
import { LOGGER } from "@modules/platform/logging"
import type { Logger } from "@modules/platform/logging"
import { CustomerIntentContextService } from "./customer-intent-context.service"
import { CustomerTurnsLogEvent } from "./customer-turns.log-events"
import { TurnModulesService } from "./turn-modules.service"

interface Options {
    readonly authority?: () => Promise<never>
    readonly hiring?: () => Promise<string>
    readonly modules?: () => Promise<ReadonlyArray<string>>
    readonly files?: IntentFileBundle
}

const build = async (options: Options = {}) => {
    const logger = mock<Logger>()
    const recall = mock<KnowledgeRecallService>({
        recall: jest.fn().mockResolvedValue({ facts: [], passages: [] }),
    })
    const moduleRef = await Test.createTestingModule({
        providers: [
            CustomerIntentContextService,
            { provide: LOGGER, useValue: logger },
            {
                provide: AuthorityService,
                useValue: mock<AuthorityService>({
                    load: jest.fn(
                        options.authority ??
                            (() =>
                                Promise.resolve({
                                    policies: "Refunds need approval",
                                    reply_style: "",
                                    brand_voice: "",
                                    limits_note: "",
                                })),
                    ),
                }),
            },
            { provide: KnowledgeRecallService, useValue: recall },
            {
                provide: IntentTurnService,
                useValue: mock<IntentTurnService>({
                    filesOf: jest.fn().mockResolvedValue(options.files ?? { parts: [], attachments: [], money: null }),
                }),
            },
            {
                provide: HiringPublicService,
                useValue: mock<HiringPublicService>({
                    chatBrief: jest.fn(options.hiring ?? (() => Promise.resolve("JOBS"))),
                }),
            },
            {
                provide: TurnModulesService,
                useValue: mock<TurnModulesService>({
                    briefs: jest.fn(options.modules ?? (() => Promise.resolve(["LOYALTY"]))),
                }),
            },
        ],
    }).compile()
    return { service: moduleRef.get(CustomerIntentContextService), logger, recall }
}

describe("CustomerIntentContextService.contextOf", () => {
    it("reads the public view for the question and gives the identity, the input in reading order and the sources of the cards", async () => {
        const { service, recall } = await build()

        const context = await service.contextOf(runtimeTurn)

        expect(context.identity).toBe("You are Bot (@bot), role: Chatbot.")
        expect(context.input.map((part) => part.kind)).toEqual([
            "owner_instructions",
            "authority",
            "shop_facts",
            "customer_message",
        ])
        expect(context.input[1]?.text).toContain("Refunds need approval")
        expect(context.input[2]?.text).toBe("JOBS\n\nLOYALTY")
        expect(context.sources).toEqual([])
        expect(recall.recall).toHaveBeenCalledWith(
            expect.objectContaining({ audience: "customer", module: "chatbot" }),
            "How much is the tea?",
        )
    })

    it("leaves out a block that cannot be read and logs it, never the turn", async () => {
        const failing = (): Promise<never> => Promise.reject(new Error("down"))
        const { service, logger } = await build({ authority: failing, hiring: failing, modules: failing })

        const context = await service.contextOf(runtimeTurn)

        expect(context.input.map((part) => part.kind)).toEqual(["owner_instructions", "customer_message"])
        expect(logger.error).toHaveBeenCalledTimes(3)
        expect(logger.error).toHaveBeenCalledWith(CustomerTurnsLogEvent.ContextPartFailed, expect.any(Error), {
            workspaceId: runtimeTurn.conversation.workspaceId,
            part: "authority",
        })
    })
})

describe("CustomerIntentContextService.contextOf > a customer image", () => {
    const transfer = (amount: number, text: string): IntentFileBundle => ({
        parts: [{ kind: "file", text }],
        attachments: [{ fileName: "bill.png", mimeType: "image/png", content: "AAAA" }],
        money: { evidence: [{ amountVnd: amount }], asked: true },
    })

    it.each([
        [3_500_000, "transfer, 3tr5"],
        [17_500_000, "transfer, 17tr5"],
    ])(
        "hands a transfer image of %i to the model as data, with the image and the money evidence as the read gave them",
        async (amount, text) => {
            const bundle = transfer(amount, text)
            const { service } = await build({ files: bundle })

            const context = await service.contextOf(runtimeTurn)

            expect(context.input.at(-1)).toEqual({ kind: "file", text })
            expect(context.attachments).toBe(bundle.attachments)
            expect(context.money).toBe(bundle.money)
        },
    )

    it("asks for the files of the message of the turn", async () => {
        const { service } = await build()

        const context = await service.contextOf(runtimeTurn)

        expect(context.attachments).toEqual([])
        expect(context.money).toBeNull()
    })
})
