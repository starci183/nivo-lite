import { z } from "zod"
import { defineAction, defineRead } from "../block/block"
import { defineModule } from "../module/declaration"
import type { ModuleDeclaration } from "../module/declaration.types"
import { defineNode } from "../node/node"
import type { NodeDefinition } from "../node/node.types"
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
        rights: [],
        effects: [],
        run: () => Promise.resolve({}),
        examples: [{ name: "one", params: {}, input: {}, output: {}, effects: [] }],
    })

/** A job of the given name. */
export const jobOf = (name: string): InstalledJob => ({ entry: "job", name })

/** An entity of the given name. */
export const entityOf = (name: string): InstalledEntity => ({ entry: "entity", name })
