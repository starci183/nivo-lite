import { z } from "zod"
import { graphDocumentSchema, graphRightSchema } from "@modules/domain/agent-graphs"
import {
    MAX_PARAMETERS,
    TEMPLATE_FORMAT,
    TEMPLATE_KEY_PATTERN,
    type AgentTemplatePackage,
} from "./agent-templates.contracts"

const textSchema = z.object({ vi: z.string().max(400), en: z.string().max(400) }).strict()

const parameterValueSchema = z.union([z.string().max(2000), z.number(), z.boolean()])

const parameterSchema = z
    .object({
        key: z
            .string()
            .max(40)
            .regex(/^[a-z]\w{0,39}$/),
        kind: z.enum(["number", "text", "toggle", "textarea", "time", "choice"]),
        label: textSchema,
        hint: textSchema.nullable(),
        min: z.number().nullable(),
        max: z.number().nullable(),
        required: z.boolean(),
        default: parameterValueSchema,
        options: z
            .array(z.object({ value: z.string().min(1).max(60), label: textSchema }).strict())
            .min(1)
            .max(20)
            .optional(),
    })
    .strict()

const bindingSchema = z.discriminatedUnion("target", [
    z
        .object({
            parameter: z.string().max(40),
            target: z.literal("branch_value"),
            nodeKey: z.string().max(60),
            branchKey: z.string().max(60),
            termIndex: z.number().int().min(0).max(30),
        })
        .strict(),
    z
        .object({
            parameter: z.string().max(40),
            target: z.literal("branch_timeout"),
            nodeKey: z.string().max(60),
            branchKey: z.string().max(60),
        })
        .strict(),
])

const likenessSchema = z
    .object({
        personName: z.string().min(1).max(120),
        allowedUses: z
            .array(z.enum(["name", "avatar", "voice_style", "first_person"]))
            .min(1)
            .max(4),
        disclosure: z.string().min(1).max(300),
    })
    .strict()

/** The package of an agent template, validated at every write and every read: nothing else parses. */
export const agentTemplatePackageSchema: z.ZodType<AgentTemplatePackage> = z
    .object({
        format: z.literal(TEMPLATE_FORMAT),
        key: z.string().max(60).regex(TEMPLATE_KEY_PATTERN),
        version: z.number().int().min(1),
        publisher: z.object({ creatorId: z.string().min(1).max(60), displayName: z.string().min(1).max(120) }).strict(),
        baseModule: z.string().min(1).max(60),
        requiresPlugins: z
            .array(z.object({ key: z.string().max(60), minVersion: z.number().int().min(0) }).strict())
            .max(20),
        listing: z
            .object({
                name: textSchema,
                summary: textSchema,
                points: z.array(textSchema).max(8),
                category: z.string().max(60),
            })
            .strict(),
        graph: graphDocumentSchema,
        parameters: z.array(parameterSchema).max(MAX_PARAMETERS),
        bindings: z.array(bindingSchema).max(MAX_PARAMETERS * 3),
        proposedRights: z.array(graphRightSchema).max(10),
        requiredProviders: z.array(z.string().max(40)).max(20),
        requiredAuthorityActions: z.array(z.string().max(100)).max(40),
        starterKnowledge: z
            .array(z.object({ title: z.string().min(1).max(200), body: z.string().min(1).max(20_000) }).strict())
            .max(20),
        persona: z.object({ soul: z.string().max(4000), likeness: likenessSchema.nullable() }).strict(),
        hash: z.string().length(64),
    })
    .strict()
