import { Injectable, Optional } from "@nestjs/common"
import { orderAddressOf, orderCardOf, orderCardWithPhotos } from "@nivo-lite/blocks-core"
import type { ChannelSendPayload } from "@nivo-lite/blocks-core"
import type { LineFile, LineOrder } from "@nivo-lite/blocks-core/rules/chatbot"
import { GraphNodeRegistryService } from "@modules/domain/graph-nodes"
import type { NodeTurn } from "@modules/domain/graph-nodes"
import { InjectLogger } from "@modules/platform/logging"
import type { Logger } from "@modules/platform/logging"
import { storedFilesOf } from "./chat-node-media.policy"
import { ChatNodePortsLogEvent } from "./chat-node-ports.log-events"
import type { ChannelSend } from "./chat-node-ports.policy"

/** The most catalogue items read to find the photos of an order card. */
const CATALOGUE_ROWS = 500

/** The words under the picture of a catalogue item: its name, then its price when the shop set one. */
const captionOf = (name: unknown, priceVnd: unknown): string =>
    [typeof name === "string" ? name : "", typeof priceVnd === "number" ? `${priceVnd.toLocaleString("de-DE")} VND` : ""]
        .filter((part) => part !== "")
        .join("\n")

/** What a stored line keeps of what the customer received: the members are left out when the send carried none. */
export interface LineMedia {
    /** The pictures and files of the send. */
    readonly files?: ReadonlyArray<LineFile>
    /** The order the send is about, with the photo of each item. */
    readonly order?: LineOrder
}

/** A send whose conversation is already resolved: the executor finds it for both ways a payload addresses a customer. */
type ConversationSend = Extract<ChannelSendPayload, { readonly conversationId: string }>

@Injectable()
/**
 * What the stored line of a `channel.send` keeps beside its words, so the inbox shows what the customer received: the pictures of the send (the
 * showcase album, the payment QR) and the order card the node gave, with the photo of each ordered item found in the shop's catalogue by name.
 * A catalogue that cannot be read leaves the card without photos (the thread draws a sprout) and says so in the log; it never stops the send.
 */
export class ChatLineMediaService {
    constructor(
        @InjectLogger() private readonly logger: Logger,
        @Optional() private readonly registry?: GraphNodeRegistryService,
    ) {}

    /**
     * What a send asked for by id, built from the records: the card of the order it names (number, lines, prices and total as the order
     * record holds them, with the catalogue photos) and one picture per catalogue item it names, captioned with the catalogue's name and
     * price. An order or an item that is not there, or has no photo, is left out; the words always go.
     */
    async resolved(turn: NodeTurn, asked: ConversationSend): Promise<ChannelSend> {
        const plain: ChannelSend = { conversationId: asked.conversationId, text: asked.text }
        const itemIds = asked.catalogueItemIds ?? []
        if (this.registry === undefined || (asked.orderId === undefined && itemIds.length === 0)) return plain
        const catalogue = await this.registry
            .portOf("catalogue-item")
            .read(turn, { fields: ["id", "name", "priceVnd", "imageUrl"], limit: CATALOGUE_ROWS }, "workspace")
        const images = itemIds.flatMap((id) => {
            const item = catalogue.find((row) => row.id === id)
            return typeof item?.imageUrl === "string" && item.imageUrl !== ""
                ? [{ url: item.imageUrl, caption: captionOf(item.name, item.priceVnd) }]
                : []
        })
        const order = asked.orderId === undefined ? undefined : await this.cardOf(turn, asked.orderId, catalogue)
        return {
            ...plain,
            ...(images.length === 0 ? {} : { images }),
            ...(order === undefined ? {} : { order }),
        }
    }

    /** The card of an order from its record, or undefined when the order is not there. */
    private async cardOf(
        turn: NodeTurn,
        orderId: string,
        catalogue: ReadonlyArray<Readonly<Record<string, unknown>>>,
    ): Promise<LineOrder | undefined> {
        const [order] = await this.registry
            ?.portOf("order")
            .read(
                turn,
                { where: { id: orderId }, fields: ["orderNo", "amountVnd", "items", "note", "deliveryAddress", "status"], limit: 1 },
                "workspace",
            ) ?? []
        if (typeof order?.orderNo !== "string") return undefined
        return orderCardOf(
            {
                orderNo: order.orderNo,
                amountVnd: typeof order.amountVnd === "number" ? order.amountVnd : null,
                items: order.items,
                address: orderAddressOf(order),
                paid: order.status === "paid",
            },
            catalogue.map((row) => ({
                name: typeof row.name === "string" ? row.name : "",
                imageUrl: typeof row.imageUrl === "string" ? row.imageUrl : null,
            })),
            turn.locale,
        )
    }

    /** The media of a send. */
    async of(turn: NodeTurn, send: ChannelSend): Promise<LineMedia> {
        const files = storedFilesOf(send)
        const order = await this.orderOf(turn, send.order)
        return {
            ...(files.length === 0 ? {} : { files }),
            ...(order === undefined ? {} : { order }),
        }
    }

    private async orderOf(turn: NodeTurn, card: LineOrder | undefined): Promise<LineOrder | undefined> {
        if (card === undefined || this.registry === undefined) return card
        try {
            const rows = await this.registry
                .portOf("catalogue-item")
                .read(turn, { fields: ["name", "imageUrl"], limit: CATALOGUE_ROWS }, "workspace")
            return orderCardWithPhotos(
                card,
                rows.map((row) => ({
                    name: typeof row.name === "string" ? row.name : "",
                    imageUrl: typeof row.imageUrl === "string" ? row.imageUrl : null,
                })),
            )
        } catch {
            this.logger.warn(ChatNodePortsLogEvent.OrderPhotosUnavailable, { turnId: turn.turnId })
            return card
        }
    }
}
