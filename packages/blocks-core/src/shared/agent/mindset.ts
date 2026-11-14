import ledger from "../../agents/sales/ledger/craft/mindset/vi.json"
import booking from "../../agents/booking/craft/mindset/vi.json"
import chatbot from "../../agents/chatbot/craft/mindset/vi.json"
import content from "../../agents/content/craft/mindset/vi.json"
import hiring from "../../agents/hiring/craft/mindset/vi.json"
import leadGen from "../../agents/lead-gen/craft/mindset/vi.json"
import sales from "../../agents/sales/craft/mindset/vi.json"
import video from "../../agents/video/craft/mindset/vi.json"

/** The agent modules that carry a base mindset. */
export type MindsetModule = "sales" | "chatbot" | "lead_gen" | "hiring" | "booking" | "video" | "content"

/** One rule-like document of a base mindset: a stable id, a short title and the markdown body an agent follows. */
export interface MindsetDocument {
    /** The stable id, unique inside its module (the file slug). */
    readonly id: string
    /** The short title. */
    readonly title: string
    /** The rules and examples, in Vietnamese. */
    readonly body: string
}

/** The line that opens a rendered mindset: it says what the text is and what outranks it. */
export const MINDSET_HEADER =
    "NIVO BASE MINDSET (general practice for this role; the shop's own Second Brain facts and documents outrank it wherever they disagree; never invent a price, policy, date or promise):"

const MINDSETS: Readonly<Record<MindsetModule, ReadonlyArray<MindsetDocument>>> = { sales: [...sales, ...ledger], chatbot, lead_gen: leadGen, hiring, booking, video, content }

/** Whether a module key carries a base mindset. */
export const hasMindset = (module: string): module is MindsetModule => Object.hasOwn(MINDSETS, module)

/**
 * The base mindset ("tri thuc goc") NIVO ships for one agent module, in reading order. It ships as code with blocks-core: no seed, no
 * migration. PRECEDENCE: it is the floor every workspace inherits; a shop's own Second Brain (confirmed facts, business documents)
 * overrides it at answer time, so a node puts the brain before this text and tells the model the brain wins. A module without a mindset
 * answers an empty list.
 */
export const mindsetOf = (module: string): ReadonlyArray<MindsetDocument> =>
    hasMindset(module) ? MINDSETS[module] : []

/** The mindset of a module as one prompt block (header, then each document as a titled section); empty when the module has none. */
export const mindsetBrief = (module: string): string => {
    const documents = mindsetOf(module)
    if (documents.length === 0) return ""
    return [MINDSET_HEADER, ...documents.map((document) => `## ${document.title}\n${document.body}`)].join("\n\n")
}
