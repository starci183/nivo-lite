import { Test } from "@nestjs/testing"
import { mock } from "@starci/jest-preset"
import { GraphNodeRegistryService } from "@modules/domain/graph-nodes"
import type { NodeTurn } from "@modules/domain/graph-nodes"
import { LOGGER } from "@modules/platform/logging"
import type { Logger } from "@modules/platform/logging"
import { ChatLineMediaService } from "./chat-line-media.service"
import { ChatNodePortsError, ChatNodePortsErrorCode } from "./errors/chat-node-ports.error"

const TURN: NodeTurn = {
    turnId: "t",
    workspaceId: "ws-1",
    agentId: "a-1",
    subject: null,
    conversationId: "c1",
    locale: "vi",
}

const SEND = { conversationId: "c1", text: "Hello" }
const QR = "https://qr.sepay.vn/img?acc=1&bank=MB&amount=5000&des=DH1&template=compact"
const CARD = {
    orderNo: "DH-1",
    lines: [
        { name: "Basket", qty: 1, unitText: "2.000", amountText: "2.000" },
        { name: "Unknown pot", qty: 1 },
    ],
    amountText: "2.000",
    address: "",
    paid: false,
}

const build = async () => {
    const registry = mock<GraphNodeRegistryService>()
    const logger = mock<Logger>()
    const moduleRef = await Test.createTestingModule({
        providers: [
            ChatLineMediaService,
            { provide: LOGGER, useValue: logger },
            { provide: GraphNodeRegistryService, useValue: registry },
        ],
    }).compile()
    return { media: moduleRef.get(ChatLineMediaService), registry, logger }
}

describe("ChatLineMediaService", () => {
    it("keeps the album and the payment QR the customer received", async () => {
        const { media } = await build()
        const images = [
            { url: "https://api/p/1/image", caption: "Basket\n2.000 VND" },
            { url: QR, caption: "DH1" },
        ]

        await expect(media.of(TURN, { ...SEND, images })).resolves.toEqual({
            files: [
                { id: "file-1", url: "https://api/p/1/image", name: "Basket", contentType: "image/jpeg" },
                { id: "file-2", url: QR, name: "DH1", contentType: "image/png" },
            ],
        })
    })

    it("keeps the order card with the photos of the catalogue items it finds by name", async () => {
        const { media, registry } = await build()
        registry.portOf.mockReturnValue({
            kind: "catalogue-item",
            read: () => Promise.resolve([{ name: "basket", imageUrl: "https://api/p/9/image" }]),
        })

        const { order } = await media.of(TURN, { ...SEND, order: CARD })

        expect(order?.orderNo).toBe("DH-1")
        expect(order?.lines[0]).toMatchObject({ name: "Basket", imageUrl: "https://api/p/9/image" })
        expect(order?.lines[1]).not.toHaveProperty("imageUrl")
    })

    it("keeps the order card without photos and says so when the catalogue cannot be read", async () => {
        const { media, registry, logger } = await build()
        registry.portOf.mockImplementation(() => {
            throw new ChatNodePortsError({ code: ChatNodePortsErrorCode.InvalidPayload })
        })

        await expect(media.of(TURN, { ...SEND, order: CARD })).resolves.toEqual({ order: CARD })
        expect(logger.warn).toHaveBeenCalledWith("chat_node_ports.order_photos_unavailable", { turnId: "t" })
    })

    it("keeps nothing for a plain text", async () => {
        const { media } = await build()

        await expect(media.of(TURN, SEND)).resolves.toEqual({})
    })
})

describe("ChatLineMediaService what a send names by id", () => {
    const CATALOGUE = [
        { id: "i1", name: "Basket", priceVnd: 2000, imageUrl: "https://api/p/1/image" },
        { id: "i2", name: "Pot", priceVnd: null, imageUrl: "https://api/p/2/image" },
        { id: "i3", name: "No photo", priceVnd: 1000, imageUrl: null },
    ]
    const ORDER = {
        orderNo: "DH-1",
        amountVnd: 2000,
        items: { lines: [{ name: "basket", qty: 1, unitVnd: 2000, amountVnd: 2000 }] },
        note: "25 Nguyen Hue",
        status: "paid",
    }

    const world = async (orders: ReadonlyArray<Readonly<Record<string, unknown>>> = [ORDER]) => {
        const built = await build()
        built.registry.portOf.mockImplementation((kind) =>
            mock<ReturnType<GraphNodeRegistryService["portOf"]>>({
                kind,
                read: jest.fn().mockResolvedValue(kind === "order" ? orders : CATALOGUE),
            }),
        )
        return built
    }

    it("turns catalogue item ids into pictures captioned with the catalogue's name and price, skipping an item without a photo", async () => {
        const { media } = await world()
        await expect(media.resolved(TURN, { ...SEND, catalogueItemIds: ["i1", "i2", "i3", "i9"] })).resolves.toEqual({
            ...SEND,
            images: [
                { url: "https://api/p/1/image", caption: "Basket\n2.000 VND" },
                { url: "https://api/p/2/image", caption: "Pot" },
            ],
        })
    })

    it("builds the order card from the order record: number, lines, total, delivery and whether it is paid", async () => {
        const { media } = await world()
        const sent = await media.resolved(TURN, { ...SEND, orderId: "o1" })
        expect(sent.order).toMatchObject({
            orderNo: "DH-1",
            lines: [{ name: "basket", qty: 1, imageUrl: "https://api/p/1/image" }],
            address: "25 Nguyen Hue",
            paid: true,
        })
        expect(sent.order?.amountText).toContain("2.000")
    })

    it("sends the words alone when the order is not there, and reads nothing when no id is named", async () => {
        const missing = await world([])
        await expect(missing.media.resolved(TURN, { ...SEND, orderId: "o9" })).resolves.toEqual(SEND)
        const plain = await world()
        await expect(plain.media.resolved(TURN, SEND)).resolves.toEqual(SEND)
        expect(plain.registry.portOf).not.toHaveBeenCalled()
    })
})
