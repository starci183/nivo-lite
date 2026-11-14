import { z } from "zod"
import { defineAction, defineRead } from "../block/block"
import { definePort, unprovided } from "../port/port"
import type { PortDefinition, PortProvider, RunContext } from "../port/port.types"
import type { ActionDefinition, ActionResult, ReadDefinition } from "../block/block.types"
import { defineJob, type JobContext, type JobDefinition } from "../mutation/job"
import { doorPort, type DoorApi } from "../mutation/door-port"

/** A port with one method, and a provider that supports only it. */
export interface Counter {
    /** The next number. */
    next(): number
}

export const counterPort: PortDefinition<Counter> = definePort<Counter>("demo.counter")

export const provider: PortProvider = {
    implementationOf: (port) => (port.id === counterPort.id ? { next: () => 7 } : unprovided(port)),
}

export const context: RunContext = {
    workspaceId: "w",
    memberId: null,
    now: new Date("2026-11-05T00:00:00Z"),
    timeZone: "Asia/Ho_Chi_Minh",
    locale: "vi",
}
export const jobContext: JobContext = { workspaceId: "w", attempt: 1, effectKey: (step) => `k:${step}` }

const readBase = { dataKind: "demo", shape: "value", fields: ["n"], paths: {}, permission: "demo.read" } as const

export const countRead: ReadDefinition = defineRead({
    ...readBase,
    id: "demo.count",
    variables: z.object({ by: z.string().max(10).optional() }),
    ports: { counter: counterPort },
    run: (ports) => Promise.resolve(ports.counter.next()),
})

/** A read that asks for a port the provider does not support. */
export const strayRead: ReadDefinition = defineRead({
    ...readBase,
    id: "demo.stray",
    variables: z.object({}),
    ports: { door: doorPort },
    run: () => Promise.resolve(1),
})

export const failingRead: ReadDefinition = defineRead({
    ...readBase,
    id: "demo.failing",
    variables: z.object({}),
    ports: {},
    run: () => Promise.reject(new Error("bug")),
})

export const hostRead: ReadDefinition = defineRead({
    ...readBase,
    id: "demo.host",
    variables: z.object({}),
    operation: "demo.host",
})

const bump = {
    permission: "demo.write",
    label: { en: "Bump", vi: "Tang" },
    input: z.object({ id: z.string().max(20) }),
    refreshes: [],
} as const

/** The ports of the door actions. */
interface DoorPorts {
    /** The door. */
    readonly door: DoorApi
}

/** An action run that calls the door and ends well. */
const succeed = async (ports: DoorPorts): Promise<ActionResult> => {
    await ports.door.call("chat.zalo.send", {})
    return { ok: true }
}

export const bumpAction: ActionDefinition = defineAction({
    ...bump,
    id: "demo.bump",
    ports: { counter: counterPort },
    run: (ports) => Promise.resolve({ ok: true, data: ports.counter.next() }),
})

export const transactionalDoorAction: ActionDefinition = defineAction({
    ...bump,
    id: "demo.door-tx",
    ports: { door: doorPort },
    transactional: true,
    run: succeed,
})

export const plainDoorAction: ActionDefinition = defineAction({
    ...bump,
    id: "demo.door-plain",
    ports: { door: doorPort },
    run: succeed,
})

export const failingAction: ActionDefinition = defineAction({
    ...bump,
    id: "demo.failing-action",
    ports: {},
    run: () => Promise.reject(new Error("bug")),
})

export const hostAction: ActionDefinition = defineAction({
    id: "demo.host-action",
    permission: "demo.write",
    label: { en: "Host", vi: "Host" },
    operation: "demo.host-action",
})

export const calls: Array<string> = []

export const bumpJob: JobDefinition = defineJob({
    name: "demo.bump-job",
    input: z.object({ id: z.uuid() }),
    ports: { counter: counterPort },
    attempts: 2,
    run: (ports, input, ctx) => {
        calls.push(`${input.id}:${ports.counter.next()}:${ctx.effectKey("bump")}`)
        return Promise.resolve()
    },
})

export const failingJob: JobDefinition = defineJob({
    name: "demo.failing-job",
    input: z.object({}),
    ports: {},
    attempts: 2,
    run: () => Promise.reject(new Error("transient")),
})

/** A provider that supports the door port and nothing else. */
export const doorProvider: PortProvider = {
    implementationOf: (port) =>
        port.id === doorPort.id ? { call: () => Promise.resolve({ ok: true, output: null }) } : unprovided(port),
}
