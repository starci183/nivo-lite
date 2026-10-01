/** The tools the engine exposes to OpenClaw. Each one is executed by the app (/api/engine/tool) for the job own workspace and conversation. */
export const TOOL_MANIFEST = [
  { name: "knowledge.search", description: "Search the business public knowledge for passages that answer a question.", args: { query: "string" } },
  { name: "lead.create_or_update", description: "Record the customer as a lead once you know their name and need (goes through NIVO approval rules).", args: { contact_name: "string", need: "string", company: "string?", phone: "string?", email: "string?" } },
  { name: "approval.request", description: "Ask the owner to approve an answer you must not give on your own (price, discount, commitment).", args: { question: "string", proposed_answer: "string?", reason: "over_authority|unclear_outcome" } },
  { name: "handoff.to_person", description: "Hand the conversation to a person; the AI stays quiet afterwards.", args: { reason: "string" } },
] as const;

export type ToolManifestName = (typeof TOOL_MANIFEST)[number]["name"];
export const isToolName = (v: string): v is ToolManifestName => TOOL_MANIFEST.some((t) => t.name === v);
