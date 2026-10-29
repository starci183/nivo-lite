import { Injectable } from "@nestjs/common"
import type { EntityManager } from "typeorm"
import { AgentOwnershipService } from "@modules/domain/agents"
import { Secret } from "@modules/platform/config"
import { InjectPrimaryEntityManager, callDbFunction } from "@modules/platform/database"
import { eachInOrder } from "@modules/platform/primitives"
import { WorkspaceSeedError, WorkspaceSeedErrorCode } from "./errors/workspace-seed.error"
import { OFFICE_RECEIPT_PREFIX } from "./messages/workspace-seed.messages"
import { OFFICE_AGENT_KEYS, OFFICE_PERSON_KEYS } from "./office-seed.contracts"
import type {
    OfficeAccountInput,
    OfficeAgentKey,
    OfficeCommand,
    OfficeInput,
    OfficePersonKey,
    OfficeReport,
    ResolvedOfficeAuthority,
} from "./office-seed.contracts"
import { InjectSeedOfficeAuthority } from "./office-seed.decorators"
import type { OfficeAuthorityPort } from "./office-seed.port"
import { readOfficeInput } from "./office-seed.policy"
import { HAKUEN_OFFICE_AUTHORITY } from "./profiles/hakuen-office.authority.templates"
import { HAKUEN_OFFICE } from "./profiles/hakuen-office.templates"
import type { SeedAccount, SeedRequest } from "./workspace-seed.contracts"
import { InjectSeedAgents, InjectWorkspaceSeedOptions } from "./workspace-seed.decorators"
import type { WorkspaceSeedOptions } from "./workspace-seed.options"
import { readEnsureFor } from "./workspace-seed.policy"
import type { SeedAgentRecords } from "./workspace-seed.port"
import { WorkspaceSeedService } from "./workspace-seed.service"

/** The workspace an office run writes into and the owner who writes it. */
interface OfficeTarget {
    /** The workspace. */
    readonly workspaceId: string
    /** The authenticated owner. */
    readonly ownerId: string
}

/** A value for each person of the story. */
type PerPerson<T> = Readonly<Record<OfficePersonKey, T>>

/** A value for each agent of the story. */
type PerAgent<T> = Readonly<Record<OfficeAgentKey, T>>

const invalid = (): never => {
    throw new WorkspaceSeedError({ code: WorkspaceSeedErrorCode.InputInvalid })
}

const accountOfInput = (account: OfficeAccountInput): SeedAccount => ({
    email: account.email,
    name: account.name,
    password: account.password === undefined ? undefined : new Secret(account.password),
})

@Injectable()
/**
 * Seeds the story of v0.3.2 into a local or UAT workspace: the five people with their seats and rooms, the four agents with a
 * person in charge, a fallback, who may give them work and whom they may tag, and the rules and grants (through the authority
 * capability). Every step is idempotent. A dry run validates the private input and prints the plan without writing. It
 * never touches the production HAKUEN profile: the workspace name must be the story's own.
 */
export class OfficeSeedService {
    constructor(
        @InjectWorkspaceSeedOptions() private readonly options: WorkspaceSeedOptions,
        @InjectPrimaryEntityManager() private readonly entityManager: EntityManager,
        @InjectSeedAgents() private readonly records: SeedAgentRecords,
        @InjectSeedOfficeAuthority() private readonly authority: OfficeAuthorityPort,
        private readonly seeds: WorkspaceSeedService,
        private readonly agents: AgentOwnershipService,
    ) {}

    /** Runs `seed-workspace office`: the private ensure input must name the story's workspace and the given owner. */
    async officeOperator(command: OfficeCommand): Promise<OfficeReport> {
        const request = readEnsureFor(this.options.input, command.owner, HAKUEN_OFFICE.workspaceName)
        const extras = readOfficeInput(this.options.officeInput)
        const emails = [request.owner, request.manager, request.staff, extras.ha, extras.van].map(
            (account) => account.email,
        )
        if (new Set(emails).size !== emails.length) return invalid()
        if (command.execute !== true) {
            return this.print({
                ...this.receipt(null),
                people: OFFICE_PERSON_KEYS.length,
                agents: OFFICE_AGENT_KEYS.length,
                ownership: OFFICE_AGENT_KEYS.length,
                rooms: "planned",
                authority: "planned",
            })
        }
        const seeded = await this.seeds.seedOwned(request)
        const target = { workspaceId: seeded.report.workspaceId, ownerId: seeded.ownerId }
        return this.print(await this.apply(target, request, extras))
    }

    /** Applies the office to one workspace as its owner and answers what it wrote. */
    async apply(target: OfficeTarget, request: SeedRequest, extras: OfficeInput): Promise<OfficeReport> {
        const users = await this.seatPeople(target, {
            nam: request.owner,
            minh: request.manager,
            lan: request.staff,
            ha: accountOfInput(extras.ha),
            van: accountOfInput(extras.van),
        })
        const members = await this.memberIds(target.workspaceId, users)
        const agentIds = await this.keepAgents(target.workspaceId)
        const rooms = await this.ensureRooms(target.workspaceId, users, agentIds)
        await this.setOwnership(target, members, agentIds)
        const authority = await this.applyAuthority(target, members, agentIds)
        return {
            ...this.receipt(target.workspaceId),
            people: OFFICE_PERSON_KEYS.length,
            agents: OFFICE_AGENT_KEYS.length,
            ownership: OFFICE_AGENT_KEYS.length,
            rooms,
            authority,
        }
    }

    /** Ensures the account and seat of every person other than the owner and answers each person's Auth user. */
    private async seatPeople(target: OfficeTarget, accounts: PerPerson<SeedAccount>): Promise<PerPerson<string>> {
        const seat = (key: Exclude<OfficePersonKey, "nam">): Promise<string> =>
            this.seeds.ensureSeat(target.ownerId, target.workspaceId, accounts[key], HAKUEN_OFFICE.people[key].role)
        const minh = await seat("minh")
        const ha = await seat("ha")
        const van = await seat("van")
        const lan = await seat("lan")
        return { nam: target.ownerId, minh, ha, van, lan }
    }

    /** The member id of every person. */
    private async memberIds(workspaceId: string, users: PerPerson<string>): Promise<PerPerson<string>> {
        const nam = await this.agents.memberIdOf(users.nam, workspaceId)
        const minh = await this.agents.memberIdOf(users.minh, workspaceId)
        const ha = await this.agents.memberIdOf(users.ha, workspaceId)
        const van = await this.agents.memberIdOf(users.van, workspaceId)
        const lan = await this.agents.memberIdOf(users.lan, workspaceId)
        return { nam, minh, ha, van, lan }
    }

    /** Keeps every agent by its handle and answers its id. */
    private async keepAgents(workspaceId: string): Promise<PerAgent<string>> {
        const keep = (key: OfficeAgentKey): Promise<string> => {
            const agent = HAKUEN_OFFICE.agents[key]
            return this.records.ensureByHandle({
                workspaceId,
                module: agent.module,
                name: agent.name,
                handle: agent.handle,
                role: agent.role,
                instructions: agent.instructions,
            })
        }
        const sales = await keep("sales")
        const accounting = await keep("accounting")
        const care = await keep("care")
        const marketing = await keep("marketing")
        return { sales, accounting, care, marketing }
    }

    /** Opens the department rooms when the Hub rooms function is installed, then seats each agent's home and each person. */
    private async ensureRooms(
        workspaceId: string,
        users: PerPerson<string>,
        agentIds: PerAgent<string>,
    ): Promise<OfficeReport["rooms"]> {
        const [check] = await callDbFunction<{ to_regproc: string | null }>(this.entityManager, "to_regproc", [
            "public.ensure_office_rooms",
        ])
        if (check?.to_regproc == null) return "absent"
        await callDbFunction(this.entityManager, "public.ensure_office_rooms", [workspaceId])
        await eachInOrder(OFFICE_AGENT_KEYS, async (key) => {
            await callDbFunction(this.entityManager, "public.move_office_agent_home", [
                workspaceId,
                HAKUEN_OFFICE.agents[key].room,
                agentIds[key],
            ])
        })
        await eachInOrder(OFFICE_PERSON_KEYS, async (key) => {
            await callDbFunction(this.entityManager, "public.seat_office_member", [
                workspaceId,
                HAKUEN_OFFICE.people[key].room,
                users[key],
            ])
        })
        return "ready"
    }

    /** Writes who answers for each agent, who may give it work and whom it may tag, as the owner. */
    private async setOwnership(
        target: OfficeTarget,
        members: PerPerson<string>,
        agentIds: PerAgent<string>,
    ): Promise<void> {
        await eachInOrder(OFFICE_AGENT_KEYS, async (key) => {
            const agent = HAKUEN_OFFICE.agents[key]
            await this.agents.setOwnership(target.ownerId, target.workspaceId, agentIds[key], {
                ownerMemberId: members[agent.owner],
                fallbackMemberId: members[agent.fallback],
                assignableRoles: agent.assignableRoles,
                assignableRooms: agent.assignableRooms,
                canTagAgentIds: agent.canTag.map((tagged) => agentIds[tagged]),
            })
        })
    }

    /** Hands the rules and grants, resolved to the ids of the workspace, to the authority capability. */
    private async applyAuthority(
        target: OfficeTarget,
        members: PerPerson<string>,
        agentIds: PerAgent<string>,
    ): Promise<OfficeReport["authority"]> {
        const resolved: ResolvedOfficeAuthority = {
            rules: HAKUEN_OFFICE_AUTHORITY.rules.map((rule) => ({
                ...rule,
                agents: rule.agents.map((key) => agentIds[key]),
                approver_group: {
                    ...rule.approver_group,
                    members: rule.approver_group.members.map((key) => members[key]),
                },
            })),
            grants: HAKUEN_OFFICE_AUTHORITY.grants.map(({ member, ...grant }) => ({
                ...grant,
                member_id: members[member],
            })),
        }
        await this.authority.apply(target.workspaceId, resolved)
        return "applied"
    }

    /** The receipt fields every run shares. */
    private receipt(workspaceId: string | null): Pick<OfficeReport, "schema" | "profile" | "executed" | "workspaceId"> {
        return {
            schema: "nivo/workspace-office@1",
            profile: HAKUEN_OFFICE.key,
            executed: workspaceId !== null,
            workspaceId,
        }
    }

    private print(receipt: OfficeReport): OfficeReport {
        this.options.print(`${OFFICE_RECEIPT_PREFIX}${JSON.stringify(receipt)}`)
        return receipt
    }
}
