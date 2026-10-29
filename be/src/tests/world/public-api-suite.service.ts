import assert from "node:assert/strict"
import { ProcessPublicApiQueueModule } from "@features/jobs/process-public-api"
import { WORK_PERFORMER_REGISTRY } from "@modules/domain/decisions"
import type { WorkPerformerRegistry } from "@modules/domain/decisions"
import { ModulesService } from "@modules/domain/modules"
import { PUBLIC_API_QUEUE } from "@modules/queues/public-api"
import { HandoffLeadPerformerService } from "../../modules/domain/work-performers/handoff-lead-performer.service"
import type { PublicApiIdentity } from "../fixtures/builders/public-api.builder"
import { apiInbox, apiLeadRequest, apiOutbox, apiSource } from "./public-api-database.service"
import type { PublicApiRequestState } from "./public-api-database.service"
import type { LiteWorld } from "./lite-world.service"
import { PublicApiProofAccess } from "./public-api-capabilities.options"
import { openPublicApiProof } from "./public-api-proof.service"
import { registerPublicApiProcessors } from "./public-api-registration.service"
import type { RegisteredPublicApi } from "./public-api-registration.service"

/** Historical producers used this exact fallback when the caller omitted its need. */
export const DEFAULT_NEED = "Created through the API"

/** The existing customer's need must survive an admission without a supplied need. */
export const RETAINED_NEED = "Retain the annual service contract"

const fixture = async (world: LiteWorld): Promise<PublicApiIdentity & { readonly authorization: string }> => {
    const identity = {
        workspaceId: world.id(),
        userId: world.id(),
        keyId: world.id(),
        agentId: world.id(),
        key: `nvk_public_api_proof_${world.id()}`,
    }
    await openPublicApiProof(world, identity)
    return { ...identity, authorization: `Bearer ${identity.key}` }
}

const requestForLead = async (
    world: LiteWorld,
    workspaceId: string,
    externalId: string,
): Promise<PublicApiRequestState> => {
    const [row] = await apiLeadRequest(world.db.primary, workspaceId, externalId)
    assert(row !== undefined)
    return row
}

const observations = (world: LiteWorld) => ({
    source: (workspaceId: string, id: string) => apiSource(world.db.primary, workspaceId, id),
    inbox: (workspaceId: string) => apiInbox(world.db.primary, workspaceId),
    outbox: (workspaceId: string) => apiOutbox(world.db.primary, workspaceId),
})

/** Registers the world's real processors and gives each scenario its own local workspace and router delivery. */
export const preparePublicApiProof = (world: LiteWorld) => {
    const registrations: Array<RegisteredPublicApi> = []
    beforeAll(async () => {
        await world.resolve(ModulesService).sync()
        registrations.push(await registerPublicApiProcessors(world, world.resolve(ProcessPublicApiQueueModule)))
        world
            .resolve<WorkPerformerRegistry>(WORK_PERFORMER_REGISTRY)
            .add("handoff_lead", world.resolve(HandoffLeadPerformerService))
    })
    beforeEach(() => {
        jest.restoreAllMocks()
        world.resolve(PublicApiProofAccess).access = "auto"
    })
    afterEach(() => jest.restoreAllMocks())
    const registered = (): RegisteredPublicApi => {
        const entry = registrations[0]
        assert(entry !== undefined)
        return entry
    }
    const deliver = (payload: object, job: string = "public-api.request") =>
        registered().handler.handle({
            id: world.key(world.id()),
            queue: PUBLIC_API_QUEUE,
            job,
            payload,
            attempt: 1,
            signal: new AbortController().signal,
        })
    return {
        registered,
        fixture: () => fixture(world),
        deliver,
        requestForLead: (workspaceId: string, externalId: string) => requestForLead(world, workspaceId, externalId),
        ...observations(world),
    }
}
