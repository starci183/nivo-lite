import { defineAction, type ActionDefinition } from "@nivo-lite/agent-sdk/block"
import type { EntityApi, WriteValues } from "@nivo-lite/agent-sdk/entity/port"
import { z } from "zod"
import { MAX_ID, MAX_LINE } from "../../../shared/bounds"
import { RESOURCE_KINDS } from "../rules/booking"
import { BOOKING_MANAGE } from "../constants"
import { RESOURCES, SERVICES } from "../ports"
import { refusedWith, writtenOf } from "./refusal"

/** A new record (no id) is inserted; an existing one is changed at the version it was read. */
const saveRecord = async (port: EntityApi, id: string | undefined, values: WriteValues) => {
    if (id === undefined || id === "") return writtenOf(await port.insert(values))
    const found = await port.get(id)
    if (found === null) return refusedWith("record_missing")
    return writtenOf(await port.update(id, found.version, values))
}

const serviceInput = z.object({
    id: z.string().max(MAX_ID).optional(),
    name: z.string().trim().min(1).max(MAX_LINE),
    durationMin: z.number().int().min(5).max(24 * 60),
    bufferMin: z.number().int().min(0).max(24 * 60).optional(),
    priceVnd: z.number().min(0).max(1e12),
    active: z.boolean().optional(),
})

/** `blocks-core.booking.service-save`: creates a service, or changes the one the id names. */
export const SAVE_SERVICE: ActionDefinition = defineAction({
    id: "blocks-core.booking.service-save",
    permission: BOOKING_MANAGE,
    label: { key: "action_save_service" },
    input: serviceInput,
    ports: { services: SERVICES },
    transactional: true,
    run: ({ services }, { id, name, durationMin, bufferMin, priceVnd, active }) =>
        saveRecord(services, id, { name, durationMin, bufferMin: bufferMin ?? 0, priceVnd, active: active ?? true }),
    refreshes: ["blocks-core.booking.api.service.list"],
    optimistic: false,
})

const resourceInput = z.object({
    id: z.string().max(MAX_ID).optional(),
    name: z.string().trim().min(1).max(MAX_LINE),
    kind: z.enum(RESOURCE_KINDS),
    capacity: z.number().int().min(1).max(1_000),
    active: z.boolean().optional(),
})

/** `blocks-core.booking.resource-save`: creates a person or a room that serves bookings, or changes the one the id names. */
export const SAVE_RESOURCE: ActionDefinition = defineAction({
    id: "blocks-core.booking.resource-save",
    permission: BOOKING_MANAGE,
    label: { key: "action_save_resource" },
    input: resourceInput,
    ports: { resources: RESOURCES },
    transactional: true,
    run: ({ resources }, { id, name, kind, capacity, active }) =>
        saveRecord(resources, id, { name, kind, capacity, active: active ?? true }),
    refreshes: ["blocks-core.booking.api.resource.list"],
    optimistic: false,
})
