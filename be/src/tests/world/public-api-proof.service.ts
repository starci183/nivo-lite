import { type JobClaims, type ClaimedJob, JOB_CLAIMS } from "@modules/platform/jobs"
import assert from "node:assert/strict"
import { WorkspaceMembersService } from "@modules/domain/workspace-members"
import type { LiteWorld } from "./lite-world.service"
import { cleanupJobs, cleanupWorkspace } from "./proof-database.service"
import { type PublicApiIdentity, persistPublicApiWorkspace } from "../fixtures/builders/public-api.builder"
import {
    apiRequest,
    apiWork,
    cleanApiPublications,
    type PublicApiRequestState,
    type PublicApiWorkState,
} from "./public-api-database.service"
import { cleanApiInbox } from "./inbox-database.service"

/** Builds only isolated local rows and registers cleanup of their messages, inbox and parents. */
export const openPublicApiProof = async (world: LiteWorld, identity: PublicApiIdentity): Promise<void> => {
    cleanupWorkspace(world, identity.userId, identity.workspaceId)
    world.cleanup(async () => {
        await cleanApiPublications(world.db.primary, identity.workspaceId)
        await cleanApiInbox(world.db.primary, identity.workspaceId)
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

type ClaimPublicApiResultShape = {
    claims: JobClaims
    claim: () => Promise<ClaimedJob>
    job: ClaimedJob
}

/** The real claim used by direct processor and stale-fence proofs. */
export const claimPublicApi = async (
    world: LiteWorld,
    payload: object,
    kind: string = "public-api.request",
): Promise<ClaimPublicApiResultShape> => {
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
    apiWork(world.db.primary, workspaceId)

/** An admitted request must exist before a queue delivery can be fulfilled. */
export const publicApiRequest = async (
    world: LiteWorld,
    workspaceId: string,
    id: string,
): Promise<PublicApiRequestState> => {
    const [row] = await apiRequest(world.db.primary, workspaceId, id)
    assert(row !== undefined)
    return row
}
