import { Injectable } from "@nestjs/common"
import type { ChannelSender, ChannelSenderRegistry, RegisteredSender } from "./channels.contracts"

@Injectable()
/** The senders of channels this capability does not own; an owner adds its sender once when it starts. */
export class ChannelSenderRegistryService implements ChannelSenderRegistry {
    private readonly senders = new Map<string, ChannelSender>()

    /** Registers the sender for every channel it names; a later registration replaces an earlier one. */
    add(sender: ChannelSender): void {
        for (const channel of sender.channels) this.senders.set(channel, sender)
    }

    /** The sender serving the channel, or undefined. */
    get(channel: string): RegisteredSender {
        return this.senders.get(channel)
    }
}
