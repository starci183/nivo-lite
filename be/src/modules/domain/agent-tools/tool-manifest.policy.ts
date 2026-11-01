import type {
    BookingToolName,
    GatewayToolName,
    ReadToolName,
    ToolManifestEntry,
    ToolName,
} from "./agent-tools.contracts"

/** The supported names used by manifest callers and dispatch policies. */
export type { ToolName } from "./agent-tools.contracts"

/** The tools the app exposes to OpenClaw. Each one runs for the job's own workspace and conversation. */
export const TOOL_MANIFEST: ReadonlyArray<ToolManifestEntry> = [
    {
        name: "knowledge.search",
        description: "Search the business public knowledge for passages that answer a question.",
        args: { query: "string" },
    },
    {
        name: "memory.read",
        description:
            "Read the standing memory of the business: the facts in force and the approved lessons you work by.",
        args: {},
    },
    {
        name: "lead.create_or_update",
        description:
            "Record the customer as a lead once you know their name and need (goes through NIVO approval rules).",
        args: { contact_name: "string", need: "string", company: "string?", phone: "string?", email: "string?" },
    },
    {
        name: "approval.request",
        description:
            "Ask the owner to approve an answer you must not give on your own (a price, a special offer, a commitment).",
        args: { question: "string", proposed_answer: "string?", reason: "over_authority|unclear_outcome" },
    },
    {
        name: "handoff.to_person",
        description: "Hand the conversation to a person; the AI stays quiet afterwards.",
        args: { reason: "string" },
    },
    {
        name: "conversation.handOff",
        description:
            "Hand this conversation to another agent of the business (its id or department) when your knowledge says that agent takes it from here.",
        args: { to: "string", note: "string" },
    },
    {
        name: "tool.search",
        description:
            "Find the connector tools you may use (installed, approved and granted to you) by what they do; answers at most 10.",
        args: { query: "string", limit: "number?" },
    },
    {
        name: "tool.describe",
        description: "Read the argument schema, mode and limits of one connector tool by its full name.",
        args: { name: "string" },
    },
    {
        name: "tool.call",
        description:
            "Call one connector tool by its full name in the order your knowledge gives; never claim a result the tool did not answer. A call over your limits waits for a person.",
        args: { name: "string", arguments_json: "string?" },
    },
    {
        name: "tool.sequence",
        description:
            "Ask a person to approve several connector calls at once when your knowledge names a playbook of steps; they run in order once approved, then the customer hears the reply.",
        args: { steps_json: "string", reply: "string?" },
    },
    {
        name: "booking.find_slots",
        description: "List the free appointment slots of a service on a date so the customer can pick one.",
        args: { service: "string?", date: "string", party_size: "number?" },
    },
    {
        name: "booking.request",
        description: "Request an appointment slot for the customer; the business confirms it afterwards.",
        args: {
            slot: "string",
            contact_name: "string",
            contact: "string?",
            service: "string?",
            party_size: "number?",
            note: "string?",
        },
    },
    {
        name: "booking.cancel",
        description: "Ask the owner to cancel the customer's next appointment booked with their phone number.",
        args: { contact: "string", reason: "string?" },
    },
]

/** True when the text names a tool of the manifest. */
export const isToolName = (value: string): value is ToolName => TOOL_MANIFEST.some((tool) => tool.name === value)

/** True for the reads of NIVO's own knowledge, which any running turn may make under its own view. */
export const isReadTool = (tool: ToolName): tool is ReadToolName =>
    tool === "knowledge.search" || tool === "memory.read"

/** True for the booking tools, which the booking lane serves. */
export const isBookingTool = (tool: ToolName): tool is BookingToolName =>
    tool === "booking.find_slots" || tool === "booking.request" || tool === "booking.cancel"

/** True for the connector meta-tools, which the gateway serves. */
export const isGatewayTool = (tool: ToolName): tool is GatewayToolName =>
    tool === "tool.search" || tool === "tool.describe" || tool === "tool.call" || tool === "tool.sequence"
