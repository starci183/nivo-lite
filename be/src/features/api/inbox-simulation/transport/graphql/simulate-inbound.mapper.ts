import type { InboxSimulationReceipt } from "@modules/domain/inbox-simulation"
import type { Locale } from "@modules/platform/i18n"
import type { SimulateInboundRequest } from "../../application/simulate-inbound.contracts"
import type { SimulateInboundInput } from "./dto/simulate-inbound.input"
import type { SimulateInboundType } from "./dto/simulate-inbound.type"

/** Maps the GraphQL simulator input with its selected workspace and accepted language. */
export const toSimulateInboundRequest = (
    workspaceId: string,
    locale: Locale,
    input: SimulateInboundInput,
): SimulateInboundRequest => ({
    workspaceId,
    simulation: {
        channel: input.channel,
        kind: input.kind,
        senderName: input.senderName,
        senderContact: input.senderContact,
        body: input.body,
        amountVnd: input.amountVnd,
        externalRef: input.externalRef,
        items: input.items,
        eventId: input.eventId,
        locale,
    },
})

/** Maps the immediate receipt without wrapping it in an envelope. */
export const toSimulateInboundType = (result: InboxSimulationReceipt): SimulateInboundType => ({ ...result })
