import { moduleDef } from "@/lib/module-registry"

/** The glyph of the agent mark an approval card shows next to the drafting agent's name. */
export const approvalAgentGlyph = (): string => moduleDef("chatbot").glyph
