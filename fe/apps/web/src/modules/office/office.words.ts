import type { OfficeAvatarView, OfficeText } from "@/modules/types"
import { glyphOf } from "./office.helpers"
import type { OfficeAgent, OfficeLead, OfficeStaff } from "./office.types"

/** The words and the formats of the Office: the translators and the number and date formatters, resolved once. */
export interface OfficeWords {
    readonly t: OfficeText
    readonly g: OfficeText
    readonly time: (iso: string) => string
    readonly day: (iso: string) => string
    readonly stamp: (iso: string) => string
    readonly money: (amount: number) => string
    /** The module name in the reader language. */
    readonly moduleName: (module: string) => string
}

/** What the views read besides the data: who is signed in, who is around, what is focused. */
export interface OfficeContext {
    /** The name the signed-in person writes under, if known. */
    readonly meName: string | null
    readonly meUserId: string | null
    /** May the signed-in person decide an item assigned to this staff row? */
    readonly canDecide: (assignedStaffId: string | null) => boolean
    readonly agents: ReadonlyArray<OfficeAgent>
    readonly staff: ReadonlyArray<OfficeStaff>
    readonly leads: ReadonlyArray<OfficeLead>
    readonly nowIso: string
    /** Work item id to its department, for the link on a command mirror line. */
    readonly workModules: ReadonlyMap<string, string>
    readonly focusedId: string | null
    readonly alreadyIds: ReadonlyArray<string>
}

/** The avatar of NIVO Core: a person mark named after the product. */
export const NIVO_AVATAR: OfficeAvatarView = { kind: "person", name: "NIVO" }

/** The avatar of an installed agent: its picture, else the generated avatar of its id. */
export const agentAvatarOf = (agent: OfficeAgent): OfficeAvatarView => ({
    kind: "agent",
    glyph: glyphOf(agent.module),
    module: agent.module,
    label: agent.name,
    seed: agent.id,
    src: agent.avatarUrl,
})

/** The avatar of the agent with this id, named as the line names it; an unknown agent draws the generated avatar of its name. */
export const avatarOfAgentId = (context: OfficeContext, agentId: string | null, label: string): OfficeAvatarView => {
    const agent = context.agents.find((candidate) => candidate.id === agentId)
    return {
        kind: "agent",
        glyph: glyphOf(agent?.module ?? "chatbot"),
        module: agent?.module ?? "chatbot",
        label,
        seed: agent?.id ?? label,
        src: agent?.avatarUrl ?? null,
    }
}

/** The active agent installed for a department, if any. */
export const departmentAgentOf = (context: OfficeContext, department: string): OfficeAgent | null =>
    context.agents.find((agent) => agent.module === department && agent.isActive) ?? null

/** The name of a lead, when the board knows it. */
export const leadNameOf = (context: OfficeContext, leadId: string | null): string | null =>
    context.leads.find((lead) => lead.id === leadId)?.name ?? null
