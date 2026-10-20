import type { GatewayConnectorManifest, GatewayToolSpec, GrantMode, ToolScope } from "../mcp-gateway.contracts"

const OBJECT = { type: "object" }

const tool = (
    name: string,
    scope: ToolScope,
    defaultMode: GrantMode,
    description: string,
    secretFields: ReadonlyArray<string> = [],
): GatewayToolSpec => ({ name, scope, defaultMode, description, inputSchema: OBJECT, secretFields })

/**
 * The HAKUEN Back-office tools NIVO is written against (`hakuen-mcp@1`, PLAN 3.2). The live catalog comes from the server's
 * `tools/list` (schemas, descriptions); this list adds what the server does not say: the scope, the default grant mode NIVO starts a
 * new grant at, and the members the audit masks.
 */
export const HAKUEN_MANIFEST: GatewayConnectorManifest = {
    key: "hakuen",
    name: "HAKUEN Back-office",
    kind: "remote",
    contractVersion: "hakuen-mcp@1",
    tools: [
        tool("rooms.searchAvailability", "read", "auto", "Room types free for a check-in date, nights and guests."),
        tool("rates.quote", "read", "auto", "Nightly price, total and cancellation policy of a room type."),
        tool(
            "booking.hold",
            "write",
            "auto",
            "Hold a room type for 30 minutes for a guest; answers holdId and expiry.",
        ),
        tool("booking.confirm", "write", "auto", "Confirm a held booking, optionally with a discount percentage."),
        tool("booking.cancel", "write", "ask", "Cancel a booking with a reason."),
        tool("spa.findSlots", "read", "auto", "Free spa slots for a service, date, party size and earliest time."),
        tool("spa.hold", "write", "auto", "Hold a spa slot for a guest and party size."),
        tool(
            "spa.confirm",
            "write",
            "auto",
            "Confirm a held spa booking; charged to the guest's stay when there is one.",
        ),
        tool(
            "guest.findByChannelIdentity",
            "read",
            "auto",
            "The guest of a channel identity (Zalo id), tier and stays.",
        ),
        tool("guest.upsertByChannelIdentity", "write", "auto", "Create or update the guest of a channel identity."),
        tool("stay.current", "read", "auto", "The current or next stay of a guest or a room number."),
        tool("stay.checkIn", "write", "ask", "Check a stay in, optionally early."),
        tool("stay.checkOut", "write", "ask", "Check a stay out."),
        tool("keycode.reveal", "restricted", "never", "The room key code of a checked-in stay.", ["code", "keyCode"]),
        tool("folio.get", "read", "auto", "Folio lines, paid, balance and transfer reference of a stay."),
        tool("folio.recordPayment", "write", "ask", "Record a bank payment on a folio."),
    ],
}
