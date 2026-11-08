import {
    type PublicApiOutboxState,
    type PublicApiInboxState,
    type PublicApiSourceState,
    apiInbox,
    apiOutbox,
    apiSource,
} from "./public-api-database.service"
import assert from "node:assert/strict"
import { ProcessPublicApiQueueModule } from "@features/jobs/process-public-api"
import { ModulesService } from "@modules/domain/modules"
import { PUBLIC_API_QUEUE } from "@modules/queues/public-api"
import type { PublicApiIdentity } from "../fixtures/builders/public-api.builder"
import type { LiteWorld } from "./lite-world.service"
import { PublicApiProofAccess } from "./public-api-capabilities.options"
import { openPublicApiProof } from "./public-api-proof.service"
import { registerPublicApiProcessors, type RegisteredPublicApi } from "./public-api-registration.service"

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

const observations = (world: LiteWorld) => ({
    source: (workspaceId: string, id: string): Promise<Array<PublicApiSourceState>> =>
        apiSource(world.db.primary, workspaceId, id),
    inbox: (workspaceId: string): Promise<Array<PublicApiInboxState>> => apiInbox(world.db.primary, workspaceId),
    outbox: (workspaceId: string): Promise<Array<PublicApiOutboxState>> => apiOutbox(world.db.primary, workspaceId),
})

type PreparePublicApiProofResultFixtureShape = {
    readonly authorization: string
}

type PreparePublicApiProofResultShape = {
    source: (workspaceId: string, id: string) => Promise<Array<PublicApiSourceState>>
    inbox: (workspaceId: string) => Promise<Array<PublicApiInboxState>>
    outbox: (workspaceId: string) => Promise<Array<PublicApiOutboxState>>
    registered: () => RegisteredPublicApi
    fixture: () => Promise<PublicApiIdentity & PreparePublicApiProofResultFixtureShape>
    deliver: (payload: object, job?: string) => Promise<void>
}

/** Registers the world's real processors and gives each scenario its own local workspace and router delivery. */
export const preparePublicApiProof = (world: LiteWorld): PreparePublicApiProofResultShape => {
    const registrations: Array<RegisteredPublicApi> = []
    beforeAll(async () => {
        await world.resolve(ModulesService).sync()
        registrations.push(await registerPublicApiProcessors(world, world.resolve(ProcessPublicApiQueueModule)))
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
    const deliver = (payload: object, job: string = "public-api.request"): Promise<void> =>
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
        fixture: (): Promise<
            PublicApiIdentity & {
                readonly authorization: string
            }
        > => fixture(world),
        deliver,
        ...observations(world),
    }
}
