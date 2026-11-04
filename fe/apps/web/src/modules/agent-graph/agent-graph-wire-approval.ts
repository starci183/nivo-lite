import { z } from "zod"

const groupSchema = z.looseObject({
    roles: z.array(z.string()),
    rooms: z.array(z.string()),
    members: z.array(z.string()),
})

const onTimeoutSchema = z.looseObject({
    kind: z.enum(["backup", "stop", "agent_owner", "unset"]),
    group: groupSchema.optional(),
})

type ApproverSchemaShape = z.ZodObject<
    {
        group: z.ZodObject<
            {
                roles: z.ZodArray<z.ZodString>
                rooms: z.ZodArray<z.ZodString>
                members: z.ZodArray<z.ZodString>
            },
            z.core.$loose
        >
        policy: z.ZodEnum<{
            any: "any"
            all: "all"
            sequential: "sequential"
        }>
        timeoutMinutes: z.ZodNumber
        onTimeout: z.ZodObject<
            {
                kind: z.ZodEnum<{
                    backup: "backup"
                    stop: "stop"
                    agent_owner: "agent_owner"
                    unset: "unset"
                }>
                group: z.ZodOptional<
                    z.ZodObject<
                        {
                            roles: z.ZodArray<z.ZodString>
                            rooms: z.ZodArray<z.ZodString>
                            members: z.ZodArray<z.ZodString>
                        },
                        z.core.$loose
                    >
                >
            },
            z.core.$loose
        >
    },
    z.core.$loose
>

/** Who is asked, for how long, and what happens after. */
export const approverSchema: ApproverSchemaShape = z.looseObject({
    group: groupSchema,
    policy: z.enum(["any", "all", "sequential"]),
    timeoutMinutes: z.number(),
    onTimeout: onTimeoutSchema,
})

type SourceSchemaShape = z.ZodObject<
    {
        kind: z.ZodEnum<{
            brain: "brain"
            template: "template"
            chat: "chat"
            learned: "learned"
            owner: "owner"
            rule: "rule"
        }>
        passage: z.ZodOptional<z.ZodString>
        quote: z.ZodOptional<z.ZodString>
        key: z.ZodOptional<z.ZodString>
        memberId: z.ZodOptional<z.ZodString>
        version: z.ZodOptional<z.ZodNumber>
        action: z.ZodOptional<z.ZodString>
    },
    z.core.$loose
>

/** The rule behind a node or a branch. */
export const sourceSchema: SourceSchemaShape = z.looseObject({
    kind: z.enum(["brain", "template", "chat", "learned", "owner", "rule"]),
    passage: z.string().optional(),
    quote: z.string().optional(),
    key: z.string().optional(),
    memberId: z.string().optional(),
    version: z.number().optional(),
    action: z.string().optional(),
})
