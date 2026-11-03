import { aiGenerationsEntities } from "@modules/domain/ai-generations"
import { entityRowBuilder } from "./entity-row.builder"

const AiGenerationEntity: (typeof aiGenerationsEntities)[0] = aiGenerationsEntities[0]
type AiGenerationEntity = InstanceType<typeof AiGenerationEntity>

type GenerationRowShape = {
    readonly workspaceId?: string
    readonly purpose?: string
    readonly module?: string
    readonly usageKind?: string
    readonly status?: AiGenerationEntity["status"]
    readonly input?: object
    readonly output?: object | null
    readonly error?: string | null
    readonly timings?: object
    readonly usage?: object | null
    readonly finishedAt?: Date | null
    readonly id?: string
    readonly createdAt?: Date
    readonly updatedAt?: Date
}

/** A stored generation: queued, with a one-line prompt, nothing answered yet; a case changes what it needs. */
export const generationRow: (changes?: GenerationRowShape) => AiGenerationEntity = entityRowBuilder<AiGenerationEntity>(
    {
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
        updatedAt: new Date("2026-10-12T10:00:00.000Z"),
    },
)

type LookupOptionsResultWhereShape = {
    id: string
    workspaceId: string
}

type LookupOptionsResultShape = {
    where: LookupOptionsResultWhereShape
}

/** What a lookup of a generation by id and workspace asks of the database. */
export const lookupOptions = (id: string, workspaceId: string): LookupOptionsResultShape => ({
    where: { id, workspaceId },
})

type PollOptionsResultSelectShape = {
    status: boolean
    output: boolean
    usage: boolean
    timings: boolean
}

type PollOptionsResultShape = {
    select: PollOptionsResultSelectShape
    where: LookupOptionsResultWhereShape
}

/** What a poll of a generation's progress asks of the database. */
export const pollOptions = (id: string, workspaceId: string): PollOptionsResultShape => ({
    ...lookupOptions(id, workspaceId),
    select: { status: true, output: true, usage: true, timings: true },
})
