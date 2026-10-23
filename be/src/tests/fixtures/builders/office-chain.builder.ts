import type { EntityManager } from "typeorm"
import { sql } from "@modules/platform/database"
import { eachInOrder } from "@modules/platform/primitives"

/** The member ids of the accounts of a workspace ($1 workspace, $2 users). */
const MEMBERS_OF_USERS = sql`SELECT id, user_id FROM public.workspace_members WHERE workspace_id = $1 AND user_id = ANY($2::uuid[])`

/** Seats a member in a department room ($1 workspace, $2 room key, $3 user). */
const SEAT_MEMBER = sql`SELECT public.seat_office_member($1, $2, $3) AS seated`

/** Creates the department rooms of a workspace ($1 workspace). */
const ENSURE_ROOMS = sql`SELECT public.ensure_office_rooms($1)`

/** The five people of the v0.3.2 story. */
export type OfficePerson = "nam" | "minh" | "ha" | "van" | "lan"

/** The three agents of the chain the proofs walk. */
export type OfficeAgent = "sales" | "accounting" | "care"

/** The explicit identities of one office scenario, supplied by the world. */
export interface OfficeIdentity {
    readonly workspaceId: string
    readonly users: Readonly<Record<OfficePerson, string>>
    readonly agents: Readonly<Record<OfficeAgent, string>>
}

/** What the persisted office answers: the member id of each person. */
export type OfficeMembers = Readonly<Record<OfficePerson, string>>

const PEOPLE: ReadonlyArray<{
    readonly key: Exclude<OfficePerson, "nam">
    readonly role: "manager" | "staff"
    readonly name: string
    readonly room: string
}> = [
    { key: "minh", role: "manager", name: "Anh Minh", room: "sales" },
    { key: "ha", role: "manager", name: "Chi Ha", room: "sales" },
    { key: "van", role: "staff", name: "Van", room: "accounting" },
    { key: "lan", role: "staff", name: "Lan", room: "sales" },
]

/**
 * Persists the office of the story: Nam owns the workspace (the workspace trigger seats him), anh Minh and chi Ha manage Sales, Van
 * keeps the books, Lan sells; AI Sales answers to anh Minh and may tag Ke toan AI and AI CSKH, Ke toan AI answers to Van and may tag
 * AI CSKH only, AI CSKH tags nobody. The fallback of every agent is Nam.
 */
export const persistOfficeRows = (manager: EntityManager, identity: OfficeIdentity): Promise<OfficeMembers> =>
    manager.transaction(async (tx) => {
        const { users, agents, workspaceId } = identity
        await eachInOrder(Object.values(users), async (id) => {
            await tx.insert("auth.users", { id })
        })
        await tx.insert("public.workspaces", { id: workspaceId, owner_id: users.nam, name: "HAKUEN proof" })
        await eachInOrder(PEOPLE, async (person) => {
            await tx.insert("public.workspace_members", {
                workspace_id: workspaceId,
                user_id: users[person.key],
                role: person.role,
                display_name: person.name,
            })
        })
        await tx.query(ENSURE_ROOMS, [workspaceId])
        await eachInOrder(PEOPLE, async (person) => {
            await tx.query(SEAT_MEMBER, [workspaceId, person.room, users[person.key]])
        })
        const rows = await tx.query<Array<{ id: string; user_id: string }>>(MEMBERS_OF_USERS, [
            workspaceId,
            Object.values(users),
        ])
        const memberOf = (person: OfficePerson): string => rows.find((row) => row.user_id === users[person])?.id ?? ""
        const members: OfficeMembers = {
            nam: memberOf("nam"),
            minh: memberOf("minh"),
            ha: memberOf("ha"),
            van: memberOf("van"),
            lan: memberOf("lan"),
        }
        const agent = (key: OfficeAgent, name: string, module: string) => ({
            id: agents[key],
            workspace_id: workspaceId,
            module,
            name,
            handle: `${key}-proof`,
            role: name,
            instructions: "Proof agent.",
            fallback_member_id: members.nam,
        })
        const agentRows = [
            { ...agent("care", "AI CSKH", "chatbot"), owner_member_id: members.ha, assignable_rooms: ["care"] },
            {
                ...agent("accounting", "Ke toan AI", "accounting"),
                owner_member_id: members.van,
                assignable_rooms: ["accounting"],
                can_tag_agent_ids: [agents.care],
            },
            {
                ...agent("sales", "AI Sales", "sales"),
                owner_member_id: members.minh,
                assignable_rooms: ["sales"],
                can_tag_agent_ids: [agents.accounting, agents.care],
            },
        ]
        await eachInOrder(agentRows, async (row) => {
            await tx.insert("public.agents", row)
        })
        return members
    })

/** Persists the customer of the story (chi Thao, who books the Deluxe room) and answers her lead id. */
export const persistStoryLead = async (
    manager: EntityManager,
    workspaceId: string,
    leadId: string,
): Promise<string> => {
    await manager.insert("public.leads", {
        id: leadId,
        workspace_id: workspaceId,
        contact_name: "Chi Thao",
        company: "",
        channel: "zalo",
        need: "Deluxe room 24-26/10",
    })
    return leadId
}
