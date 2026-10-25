import assert from "node:assert/strict"
import { JOB_CLAIMS } from "@modules/platform/jobs"
import type { JobClaims } from "@modules/platform/jobs"
import type { Proposal } from "@modules/domain/work-items"
import { WorkspaceMembersService } from "@modules/domain/workspace-members"
import type { LiteWorld } from "./lite-world.service"
import { cleanupJobs, cleanupWorkspace } from "./proof-database.service"
import type { PublicApiIdentity } from "../fixtures/builders/public-api.builder"
import { persistPublicApiWorkspace } from "../fixtures/builders/public-api.builder"
import * as statements from "../fixtures/persistence/public-api.sql"

/** The ledger state the proof observes through a separate transaction. */
export interface PublicApiRequestState {
    readonly id: string
    readonly kind: string
    readonly payload: Readonly<Record<string, unknown>>
    readonly need_supplied: boolean | null
    readonly lead_id: string | null
    readonly processed_at: Date | null
}

/** A durable downstream item, retained for approval and replay assertions. */
export interface PublicApiWorkState {
    readonly id: string
    readonly action: string
    readonly status: string
    readonly subject_type: string
    readonly subject_id: string | null
    readonly lead_id: string | null
    readonly inbound_event_id: string | null
    readonly dedupe_key: string
    readonly proposal: Proposal
    readonly reason: string | null
}

/** Builds only isolated local rows and registers cleanup of their messages, inbox and parents. */
export const openPublicApiProof = async (world: LiteWorld, identity: PublicApiIdentity): Promise<void> => {
    cleanupWorkspace(world, identity.userId, identity.workspaceId)
    world.cleanup(async () => {
        await world.db.primary.query(statements.CLEAN_API_PUBLICATIONS, [identity.workspaceId])
        await world.db.primary.query(statements.CLEAN_API_INBOX, [identity.workspaceId])
        await cleanupJobs(world.db.primary, world.prefix)
    })
    await persistPublicApiWorkspace(world.db.primary, identity)
    await world.resolve(WorkspaceMembersService).join({
        workspaceId: identity.workspaceId,
        userId: identity.userId,
        role: "owner",
        staffId: null,
        displayName: "Public API owner",
    })
}

/** The real claim used by direct processor and stale-fence proofs. */
export const claimPublicApi = async (world: LiteWorld, payload: object, kind: string = "public-api.request") => {
    const claims = world.resolve<JobClaims>(JOB_CLAIMS)
    const key = world.key(world.id())
    const claim = async () => {
        const job = await claims.claim({ kind, jobKey: key, payload, workerId: "public-api-proof", leaseMs: 1000 })
        assert(job !== null)
        return job
    }
    return { claims, claim, job: await claim() }
}

/** The durable work rows of one isolated workspace. */
export const publicApiWork = (world: LiteWorld, workspaceId: string): Promise<Array<PublicApiWorkState>> =>
    world.db.primary.query<Array<PublicApiWorkState>>(statements.API_WORK, [workspaceId])

/** An admitted request must exist before a queue delivery can be fulfilled. */
export const publicApiRequest = async (
    world: LiteWorld,
    workspaceId: string,
    id: string,
): Promise<PublicApiRequestState> => {
    const [row] = await world.db.primary.query<Array<PublicApiRequestState>>(statements.API_REQUEST, [workspaceId, id])
    assert(row !== undefined)
    return row
}
