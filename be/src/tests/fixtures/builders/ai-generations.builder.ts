import type { AiGenerationEntity } from "@modules/domain/ai-generations/persistence/entities"
import { entityRowBuilder } from "./entity-row.builder"

/** A stored generation: queued, with a one-line prompt, nothing answered yet; a case changes what it needs. */
export const generationRow = entityRowBuilder<AiGenerationEntity>({
    id: "g1",
    workspaceId: "w1",
    purpose: "relay",
    module: "office",
    usageKind: "relay",
    status: "queued",
    input: { messages: [{ role: "user", content: "hi" }], response_format: "text", timeout_ms: 20_000 },
    output: null,
    error: null,
    timings: {},
    usage: null,
    createdAt: new Date("2026-10-12T10:00:00.000Z"),
    finishedAt: null,
})

/** What a lookup of a generation by id and workspace asks of the database. */
export const lookupOptions = (id: string, workspaceId: string) => ({ where: { id, workspaceId } })

/** What a poll of a generation's progress asks of the database. */
export const pollOptions = (id: string, workspaceId: string) => ({
    ...lookupOptions(id, workspaceId),
    select: { status: true, output: true, usage: true, timings: true },
})
