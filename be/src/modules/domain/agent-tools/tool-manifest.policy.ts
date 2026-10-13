import type { BookingToolName, ToolManifestEntry } from "./agent-tools.contracts"

/** The tools the app exposes to OpenClaw. Each one runs for the job's own workspace and conversation. */
export const TOOL_MANIFEST = [
    {
        name: "knowledge.search",
        description: "Search the business public knowledge for passages that answer a question.",
        args: { query: "string" },
    },
    {
        name: "lead.create_or_update",
        description:
            "Record the customer as a lead once you know their name and need (goes through NIVO approval rules).",
        args: { contact_name: "string", need: "string", company: "string?", phone: "string?", email: "string?" },
    },
    {
        name: "approval.request",
        description: "Ask the owner to approve an answer you must not give on your own (price, discount, commitment).",
        args: { question: "string", proposed_answer: "string?", reason: "over_authority|unclear_outcome" },
    },
    {
        name: "handoff.to_person",
        description: "Hand the conversation to a person; the AI stays quiet afterwards.",
        args: { reason: "string" },
    },
    {
        name: "booking.find_slots",
        description: "List the free appointment slots of a service on a date so the customer can pick one.",
        args: { service: "string?", date: "string", party_size: "number?" },
    },
    {
        name: "booking.request",
        description: "Request an appointment slot for the customer; the business confirms it afterwards.",
        args: { slot: "string", contact_name: "string", contact: "string?", note: "string?" },
    },
] as const satisfies ReadonlyArray<ToolManifestEntry>

/** The name of a tool in the manifest. */
export type ToolName = (typeof TOOL_MANIFEST)[number]["name"]

/** True when the text names a tool of the manifest. */
export const isToolName = (value: string): value is ToolName => TOOL_MANIFEST.some((tool) => tool.name === value)

/** True for the two booking tools, which the booking lane serves. */
export const isBookingTool = (tool: ToolName): tool is BookingToolName =>
    tool === "booking.find_slots" || tool === "booking.request"
