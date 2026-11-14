import { z } from "zod"
import { defineRead } from "../block/block"
import { defineEntity, field } from "../entity/entity"
import { ENTITIES_PORT, entityPort } from "../entity/port/entity-port"
import type { AnyEntityDefinition } from "../entity/entity-any.types"
import type { InstallationPart, InstalledJob } from "./installation.types"

type Part = InstallationPart<InstalledJob, AnyEntityDefinition>
import { recordLawProblems } from "./record-law"

const typeOf = (name: `${string}.${string}`, relations?: Readonly<Record<string, { readonly kind: "toOne"; readonly target: string }>>) =>
    defineEntity({
        name,
        dataKind: "x",
        fields: { code: field.text({ maxLength: 4 }) },
        ...(relations === undefined ? {} : { relations: relations as never }),
    })

const order = typeOf("blocks-core.sales.order")
const lead = typeOf("blocks-core.sales.lead")
const chat = typeOf("blocks-core.chatbot.chat")

const readOf = (id: `${string}.${string}`, ports: Readonly<Record<string, ReturnType<typeof entityPort> | typeof ENTITIES_PORT>>) =>
    defineRead({
        id,
        dataKind: "x",
        shape: "list",
        fields: [],
        paths: {},
        variables: z.object({}),
        permission: "x.view",
        ports,
        run: () => Promise.resolve(null),
    })

/** A part of the core package: two template agents, the given types and the reads of one module. */
const partOf = (patch: Partial<Part>): Part => ({
    key: "core",
    packageName: "blocks-core",
    templateAgents: [{ key: "sales" }, { key: "chatbot" }] as never,
    ...patch,
})

const modulesOf = (...reads: ReadonlyArray<ReturnType<typeof readOf>>): Part["modules"] =>
    [{ key: "sales", reads, actions: [] }] as never

describe("recordLawProblems: the name law of record types and record queries", () => {
    it("accepts types and reads of the package's own agents", () => {
        expect(
            recordLawProblems([
                partOf({
                    entities: [order, lead, chat],
                    modules: modulesOf(readOf("blocks-core.sales.api.order.list", { orders: entityPort(order) })),
                }),
            ]),
        ).toEqual([])
    })

    it("names each type off the law with its owner: the short form, another package, an agent the package does not declare", () => {
        expect(
            recordLawProblems([
                partOf({
                    entities: [typeOf("sales.order"), typeOf("nivo-web-core.sales.order"), typeOf("blocks-core.webbooks.invoice")],
                }),
            ]),
        ).toEqual([
            { code: "RECORD_TYPE_NAME_FORMAT", plugin: "core", at: "sales.order" },
            { code: "RECORD_TYPE_PACKAGE", plugin: "core", at: "nivo-web-core.sales.order" },
            { code: "RECORD_TYPE_AGENT", plugin: "core", at: "blocks-core.webbooks.invoice" },
        ])
    })

    it("reports a ref to another agent's type", () => {
        const crossing = typeOf("blocks-core.sales.deal", { chat: { kind: "toOne", target: chat.name } })
        expect(recordLawProblems([partOf({ entities: [crossing, chat] })])).toEqual([
            { code: "RECORD_REF_OTHER_AGENT", plugin: "core", at: "blocks-core.sales.deal.relations.chat", detail: chat.name },
        ])
    })

    it("names each record read off the law, and a read that reaches another agent's type or every type", () => {
        expect(
            recordLawProblems([
                partOf({
                    entities: [order, chat],
                    modules: modulesOf(
                        readOf("sales.orders", { orders: entityPort(order) }),
                        readOf("other-pkg.sales.api.order.list", { orders: entityPort(order) }),
                        readOf("blocks-core.webbooks.api.order.list", { orders: entityPort(order) }),
                        readOf("blocks-core.sales.api.chat.list", { chats: entityPort(chat) }),
                        readOf("blocks-core.sales.api.all.list", { all: ENTITIES_PORT }),
                        readOf("blocks-core.sales.api.plain.get", {}),
                    ),
                }),
            ]),
        ).toEqual([
            { code: "RECORD_QUERY_NAME_FORMAT", plugin: "core", at: "sales.orders" },
            { code: "RECORD_QUERY_PACKAGE", plugin: "core", at: "other-pkg.sales.api.order.list" },
            { code: "RECORD_QUERY_AGENT", plugin: "core", at: "blocks-core.webbooks.api.order.list" },
            { code: "RECORD_QUERY_OTHER_AGENT", plugin: "core", at: "blocks-core.webbooks.api.order.list", detail: order.name },
            { code: "RECORD_QUERY_OTHER_AGENT", plugin: "core", at: "blocks-core.sales.api.chat.list", detail: chat.name },
            { code: "RECORD_QUERY_OTHER_AGENT", plugin: "core", at: "blocks-core.sales.api.all.list", detail: "engine.entities" },
        ])
    })

    it("asks a plugin that declares record types or record reads to name its package", () => {
        expect(recordLawProblems([{ key: "shop", entities: [order] }])).toEqual([
            { code: "PLUGIN_PACKAGE_NAME_MISSING", plugin: "shop", at: "shop" },
            { code: "RECORD_TYPE_PACKAGE", plugin: "shop", at: order.name },
            { code: "RECORD_TYPE_AGENT", plugin: "shop", at: order.name },
        ])
        expect(recordLawProblems([{ key: "empty" }])).toEqual([])
    })
})
