import { z } from "zod"
import { nodeSchema } from "./agent-graph-wire-node"

type DocumentSchemaShape = z.ZodObject<
    {
        nodes: z.ZodArray<
            z.ZodObject<
                {
                    key: z.ZodString
                    kind: z.ZodEnum<{
                        trigger: "trigger"
                        condition: "condition"
                        execute: "execute"
                        output: "output"
                    }>
                    step: z.ZodString
                    title: z.ZodString
                    doneBy: z.ZodEnum<{
                        agent: "agent"
                        nivo: "nivo"
                        person: "person"
                    }>
                    knows: z.ZodArray<
                        z.ZodObject<
                            {
                                label: z.ZodString
                                ref: z.ZodOptional<z.ZodString>
                            },
                            z.core.$loose
                        >
                    >
                    does: z.ZodString
                    uses: z.ZodArray<
                        z.ZodObject<
                            {
                                label: z.ZodString
                                tool: z.ZodOptional<z.ZodNullable<z.ZodString>>
                                scope: z.ZodEnum<{
                                    read: "read"
                                    write: "write"
                                }>
                            },
                            z.core.$loose
                        >
                    >
                    reads: z.ZodArray<
                        z.ZodObject<
                            {
                                label: z.ZodString
                                place: z.ZodString
                            },
                            z.core.$loose
                        >
                    >
                    writes: z.ZodArray<
                        z.ZodObject<
                            {
                                label: z.ZodString
                                place: z.ZodString
                            },
                            z.core.$loose
                        >
                    >
                    approver: z.ZodNullable<
                        z.ZodObject<
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
                    >
                    sources: z.ZodArray<
                        z.ZodObject<
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
                    >
                    next: z.ZodArray<z.ZodString>
                    decide: z.ZodOptional<
                        z.ZodObject<
                            {
                                intent: z.ZodString
                                facts: z.ZodArray<z.ZodString>
                                branches: z.ZodArray<
                                    z.ZodObject<
                                        {
                                            key: z.ZodString
                                            when: z.ZodUnknown
                                            mode: z.ZodEnum<{
                                                stop: "stop"
                                                auto: "auto"
                                                ask: "ask"
                                            }>
                                            next: z.ZodString
                                            approver: z.ZodNullable<
                                                z.ZodObject<
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
                                            >
                                            sources: z.ZodArray<
                                                z.ZodObject<
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
                                            >
                                            selfCorrected: z.ZodOptional<z.ZodBoolean>
                                        },
                                        z.core.$loose
                                    >
                                >
                            },
                            z.core.$loose
                        >
                    >
                },
                z.core.$loose
            >
        >
        rights: z.ZodArray<z.ZodUnknown>
    },
    z.core.$loose
>

/** The document of a graph: its nodes and the rights the back end adds. */
export const documentSchema: DocumentSchemaShape = z.looseObject({
    nodes: z.array(nodeSchema),
    rights: z.array(z.unknown()),
})
