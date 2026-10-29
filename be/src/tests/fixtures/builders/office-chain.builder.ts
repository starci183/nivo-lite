import { In } from "typeorm"
import type { EntityManager } from "typeorm"
import { callDbFunction } from "@modules/platform/database"
import { eachInOrder } from "@modules/platform/primitives"
import { agentsEntities } from "@modules/domain/agents"
import { leadsEntities } from "@modules/domain/leads"
import { workspacesEntities } from "@modules/domain/workspaces"
import { workspaceMembersEntities } from "@modules/domain/workspace-members"

const [AgentEntity] = agentsEntities

const [WorkspaceEntity] = workspacesEntities
const [WorkspaceMemberEntity] = workspaceMembersEntities

const [LeadEntity] = leadsEntities

/** The most member rows one read takes; the story seats five. */
const PEOPLE_MAX = 10

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
        await tx.insert(WorkspaceEntity, { id: workspaceId, ownerId: users.nam, name: "HAKUEN proof" })
        await eachInOrder(PEOPLE, async (person) => {
            await tx.insert(WorkspaceMemberEntity, {
                workspaceId: workspaceId,
                userId: users[person.key],
                role: person.role,
                displayName: person.name,
            })
        })
        await callDbFunction(tx, "public.ensure_office_rooms", [workspaceId])
        await eachInOrder(PEOPLE, async (person) => {
            await callDbFunction(tx, "public.seat_office_member", [workspaceId, person.room, users[person.key]])
        })
        const rows = await tx.find(WorkspaceMemberEntity, {
            where: { workspaceId, userId: In(Object.values(users)) },
            select: { id: true, userId: true },
            take: PEOPLE_MAX,
        })
        const memberOf = (person: OfficePerson): string => rows.find((row) => row.userId === users[person])?.id ?? ""
        const members: OfficeMembers = {
            nam: memberOf("nam"),
            minh: memberOf("minh"),
            ha: memberOf("ha"),
            van: memberOf("van"),
            lan: memberOf("lan"),
        }
        const agent = (key: OfficeAgent, name: string, module: string) => ({
            id: agents[key],
            workspaceId: workspaceId,
            module,
            name,
            handle: `${key}-proof`,
            role: name,
            instructions: "Proof agent.",
            fallbackMemberId: members.nam,
        })
        const agentRows = [
            { ...agent("care", "AI CSKH", "chatbot"), ownerMemberId: members.ha, assignableRooms: ["care"] },
            {
                ...agent("accounting", "Ke toan AI", "accounting"),
                ownerMemberId: members.van,
                assignableRooms: ["accounting"],
                canTagAgentIds: [agents.care],
            },
            {
                ...agent("sales", "AI Sales", "sales"),
                ownerMemberId: members.minh,
                assignableRooms: ["sales"],
                canTagAgentIds: [agents.accounting, agents.care],
            },
        ]
        await eachInOrder(agentRows, async (row) => {
            await tx.insert(AgentEntity, row)
        })
        return members
    })

/** Persists the customer of the story (chi Thao, who books the Deluxe room) and answers her lead id. */
export const persistStoryLead = async (
    manager: EntityManager,
    workspaceId: string,
    leadId: string,
): Promise<string> => {
    await manager.insert(LeadEntity, {
        id: leadId,
        workspaceId: workspaceId,
        contactName: "Chi Thao",
        company: "",
        channel: "zalo",
        need: "Deluxe room 24-26/10",
    })
    return leadId
}
