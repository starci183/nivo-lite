import { Injectable } from "@nestjs/common"
import type { EntityManager } from "typeorm"
import { AuthorityRulesService } from "@modules/domain/authority-rules"
import { KnowledgeQueue } from "@modules/queues/knowledge"
import { InjectClock } from "@modules/platform/clock"
import type { Clock } from "@modules/platform/clock"
import { InjectPrimaryEntityManager } from "@modules/platform/database"
import { eachInOrder } from "@modules/platform/primitives"
import { WorkspaceSeedError, WorkspaceSeedErrorCode } from "./errors/workspace-seed.error"
import { PROFILE_RECEIPT_PREFIX } from "./messages/workspace-seed.messages"
import {
    ENSURE_AGENT_INSTALLATION,
    ENSURE_OFFICE_ROOMS,
    FIND_PROFILE_SOURCE,
    INSERT_PROFILE_SOURCE,
    MOVE_AGENT_HOME,
    REQUEUE_PROFILE_SOURCE,
    ROOMS_FUNCTION_PRESENT,
    SET_WORKSPACE_BRAND,
    TOOL_GRANTS_PRESENT,
    UPSERT_PROFILE_AGENT,
    UPSERT_TOOL_GRANT,
} from "./persistence/workspace-profile.sql"
import { WORKSPACE_PROFILES } from "./profiles/workspace-profiles"
import type {
    ProfileCommand,
    ProfileDocument,
    ProfileDocumentCounts,
    ProfileReport,
    WorkspaceProfile,
} from "./workspace-profile.contracts"
import { InjectWorkspaceSeedOptions } from "./workspace-seed.decorators"
import type { WorkspaceSeedOptions } from "./workspace-seed.options"
import { readSeedInput } from "./workspace-seed.policy"
import { WorkspaceSeedService } from "./workspace-seed.service"

/** One row that answers an id. */
interface IdRow {
    /** The id. */
    readonly id: string
}

/** The owner a brand update answers. */
interface OwnerRow {
    /** The owner user id. */
    readonly owner_id: string
}

/** The seeded document found again. */
interface SourceRow {
    /** The source id. */
    readonly id: string
    /** Its stored text. */
    readonly content: string | null
}

/** Whether the rooms function exists. */
interface PresentRow {
    /** True when installed. */
    readonly present: boolean
}

/** What one document did. */
type DocumentOutcome = keyof ProfileDocumentCounts

/** The origin stamped on every document of a profile, so a re-run finds its own documents and nothing else. */
const originOf = (profile: WorkspaceProfile): string => `seed:${profile.key}`

const invalid = (): never => {
    throw new WorkspaceSeedError({ code: WorkspaceSeedErrorCode.InputInvalid })
}

@Injectable()
/**
 * Applies a named workspace profile on top of the explicit workspace seed: the brand, the agents and their installations, the
 * authority grants, the workspace documents (queued into the normal knowledge ingestion, which reads chunks and facts) and the Hub
 * department rooms. Every step is idempotent; a dry run validates the private input and prints the plan without writing.
 */
export class WorkspaceProfileService {
    constructor(
        @InjectWorkspaceSeedOptions() private readonly options: WorkspaceSeedOptions,
        @InjectPrimaryEntityManager() private readonly entityManager: EntityManager,
        @InjectClock() private readonly clock: Clock,
        private readonly seeds: WorkspaceSeedService,
        private readonly rules: AuthorityRulesService,
        private readonly queue: KnowledgeQueue,
    ) {}

    /** Runs `seed-workspace profile`: the private ensure input must name the profile's workspace and the given owner. */
    async profileOperator(command: ProfileCommand): Promise<ProfileReport> {
        const profile = WORKSPACE_PROFILES.get(command.profile) ?? invalid()
        const input = readSeedInput(this.options.input)
        if (input.action !== "ensure") return invalid()
        const { request } = input
        if (
            request.owner.email !== command.owner.trim().toLowerCase() ||
            request.workspaceName !== profile.workspaceName
        )
            return invalid()
        if (!command.execute) {
            return this.print({
                ...this.receipt(profile, null),
                documents: { inserted: profile.documents.length, requeued: 0, unchanged: 0 },
                rooms: "planned",
            })
        }
        const seeded = await this.seeds.seed(request)
        return this.print(await this.apply(seeded.workspaceId, profile))
    }

    /** Applies the profile to one workspace and answers what it wrote. */
    async apply(workspaceId: string, profile: WorkspaceProfile): Promise<ProfileReport> {
        const applied = await this.entityManager.transaction(async (tx) => {
            const [owner] = await tx.query<Array<OwnerRow>>(SET_WORKSPACE_BRAND, [
                workspaceId,
                profile.displayName,
                profile.logoUrl,
            ])
            if (owner === undefined) throw new WorkspaceSeedError({ code: WorkspaceSeedErrorCode.RowMissing })
            const homes = new Map<string, string>()
            const [grants] = await tx.query<Array<PresentRow>>(TOOL_GRANTS_PRESENT)
            const grantsPresent = grants?.present === true
            let toolGrants = 0
            await eachInOrder(profile.agents, async (agent) => {
                const [row] = await tx.query<Array<IdRow>>(UPSERT_PROFILE_AGENT, [
                    workspaceId,
                    agent.module,
                    agent.name,
                    agent.handle,
                    agent.role,
                    agent.instructions,
                ])
                if (row === undefined) throw new WorkspaceSeedError({ code: WorkspaceSeedErrorCode.RowMissing })
                await tx.query(ENSURE_AGENT_INSTALLATION, [workspaceId, agent.module, agent.name, row.id])
                if (agent.room !== null) homes.set(row.id, agent.room)
                if (!grantsPresent) return
                await eachInOrder(agent.tools, async (grant) => {
                    await tx.query(UPSERT_TOOL_GRANT, [
                        workspaceId,
                        row.id,
                        grant.tool,
                        grant.mode,
                        grant.limitVnd,
                        grant.limitPct,
                    ])
                    toolGrants += 1
                })
            })
            const documents = { inserted: 0, requeued: 0, unchanged: 0 }
            await eachInOrder(profile.documents, async (document) => {
                const outcome = await this.loadDocument(tx, workspaceId, owner.owner_id, profile, document)
                documents[outcome] += 1
            })
            const rooms = await this.ensureRooms(tx, workspaceId, homes)
            const written: ProfileReport["toolGrants"] = grantsPresent ? toolGrants : "absent"
            return { documents, rooms, toolGrants: written }
        })
        await eachInOrder(profile.rules, async (rule) => {
            await this.rules.save(workspaceId, rule)
        })
        return { ...this.receipt(profile, workspaceId), ...applied }
    }

    /** Adds a new document, re-queues one whose text changed, leaves an unchanged one alone. */
    private async loadDocument(
        tx: EntityManager,
        workspaceId: string,
        ownerId: string,
        profile: WorkspaceProfile,
        document: ProfileDocument,
    ): Promise<DocumentOutcome> {
        const origin = originOf(profile)
        const [found] = await tx.query<Array<SourceRow>>(FIND_PROFILE_SOURCE, [workspaceId, origin, document.title])
        if (found === undefined) {
            const [row] = await tx.query<Array<IdRow>>(INSERT_PROFILE_SOURCE, [
                workspaceId,
                document.module,
                document.topic,
                document.visibility,
                document.title,
                document.content,
                origin,
                ownerId,
            ])
            if (row === undefined) throw new WorkspaceSeedError({ code: WorkspaceSeedErrorCode.RowMissing })
            await this.queue.enqueueIndex({ sourceId: row.id, workspaceId }, tx)
            return "inserted"
        }
        if (found.content === document.content) return "unchanged"
        await tx.query(REQUEUE_PROFILE_SOURCE, [
            found.id,
            workspaceId,
            document.content,
            document.module,
            document.topic,
            document.visibility,
        ])
        await this.queue.enqueueIndex({ sourceId: found.id, workspaceId }, tx, this.clock.now().getTime())
        return "requeued"
    }

    /** Creates the department rooms when the Hub rooms function is installed and seats each agent in its home room. */
    private async ensureRooms(
        tx: EntityManager,
        workspaceId: string,
        homes: ReadonlyMap<string, string>,
    ): Promise<ProfileReport["rooms"]> {
        const [check] = await tx.query<Array<PresentRow>>(ROOMS_FUNCTION_PRESENT)
        if (check?.present !== true) return "absent"
        await tx.query(ENSURE_OFFICE_ROOMS, [workspaceId])
        await eachInOrder(homes, async ([agentId, room]) => {
            await tx.query(MOVE_AGENT_HOME, [workspaceId, room, agentId])
        })
        return "ready"
    }

    /** The receipt fields every run shares. */
    private receipt(profile: WorkspaceProfile, workspaceId: string | null): Omit<ProfileReport, "documents" | "rooms"> {
        return {
            schema: "nivo/workspace-profile@1",
            profile: profile.key,
            executed: workspaceId !== null,
            workspaceId,
            agents: profile.agents.length,
            rules: profile.rules.length,
            toolGrants: profile.agents.reduce((count, agent) => count + agent.tools.length, 0),
        }
    }

    private print(receipt: ProfileReport): ProfileReport {
        this.options.print(`${PROFILE_RECEIPT_PREFIX}${JSON.stringify(receipt)}`)
        return receipt
    }
}
