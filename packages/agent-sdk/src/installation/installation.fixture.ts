import { z } from "zod"
import { defineAction, defineRead } from "../block/block"
import { defineModule } from "../module/declaration"
import type { ModuleDeclaration } from "../module/declaration.types"
import { defineNode } from "../node/node"
import type { NodeDefinition } from "../node/node.types"
import { defineService, defineServiceContract } from "../service/service"
import type { AnyServiceDefinition, ServiceContract } from "../service/service.types"
import { defineWebhookEvent } from "../webhook/webhook"
import type { WebhookEventDefinition } from "../webhook/webhook.types"
import type { InstalledEntity, InstalledJob } from "./installation.types"

/** A module with one read and one action. */
export const moduleOf = (key: string): ModuleDeclaration => {
    const read = defineRead({
        id: `${key}.people`,
        dataKind: "person",
        shape: "list",
        fields: ["id"],
        paths: {},
        variables: z.object({}),
        operation: "people",
        permission: `${key}.view`,
    })
    const action = defineAction({
        id: `${key}.open`,
        operation: "open",
        permission: `${key}.view`,
        label: { key: "open" },
    })
    return defineModule({
        key,
        namespace: key,
        permissions: [`${key}.view`],
        reads: [read],
        actions: [action],
        specs: [],
    })
}

/** A node with the given id that does nothing. */
export const nodeOf = (id: `${string}.${string}`): NodeDefinition =>
    defineNode({
        id,
        role: "execute",
        title: { key: "t" },
        params: z.object({}),
        input: z.object({}),
        output: z.object({}),
        effects: [],
        run: () => Promise.resolve({}),
        examples: [{ name: "one", params: {}, input: {}, output: {}, effects: [] }],
    })

/** A job of the given name. */
export const jobOf = (name: string): InstalledJob => ({ entry: "job", name })

/** An entity of the given name. */
export const entityOf = (name: string): InstalledEntity => ({ entry: "entity", name })

/** The contract the fixture services implement. */
export const FIXTURE_CONTRACT: ServiceContract<{ readonly hello: () => string }> = defineServiceContract<{ readonly hello: () => string }>("engine.fixture-store")

/** A service `<package>.<module>.<name>` of the fixture contract (or of another contract id), owned by `moduleKey`. */
export const serviceFixture = (id: string, moduleKey: string, contractId: `${string}.${string}` = "engine.fixture-store"): AnyServiceDefinition =>
    defineService({
        id,
        contract: contractId === FIXTURE_CONTRACT.id ? FIXTURE_CONTRACT : defineServiceContract<{ readonly hello: () => string }>(contractId),
        moduleKey,
        ports: {},
        build: () => ({ hello: () => id }),
    })

/** A webhook event `<domain>.<verb>` owned by `moduleKey`. */
export const webhookEventFixture = (id: string, moduleKey: string): WebhookEventDefinition =>
    defineWebhookEvent({ id, label: { vi: `vi ${id}`, en: `en ${id}` }, moduleKey })
