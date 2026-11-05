import { Test } from "@nestjs/testing"
import type { ModuleDeclaration } from "@nivo-lite/agent-sdk/module"
import type { ListSource } from "@nivo-lite/agent-sdk/block"
import { listRead } from "@nivo-lite/agent-sdk/module"
import { definePort } from "@nivo-lite/agent-sdk/port"
import { installationFactsOf as realInstallationFactsOf } from "./installation-facts.policy"

const SUBJECT = Symbol("installation-facts.policy")

interface Subject {
    readonly installationFactsOf: typeof realInstallationFactsOf
}

const build = async (): Promise<Subject> => {
    const moduleRef = await Test.createTestingModule({
        providers: [{ provide: SUBJECT, useValue: { installationFactsOf: realInstallationFactsOf } }],
    }).compile()
    return moduleRef.get<Subject>(SUBJECT)
}

const SALES: ModuleDeclaration = {
    entry: "module",
    key: "sales",
    namespace: "sales",
    permissions: ["sales.view", "sales.manage"],
    reads: [
        listRead({
            id: "sales.leads",
            dataKind: "lead",
            permission: "sales.view",
            fields: ["id"],
            list: { sort: { recent: [["updatedAt", "desc"]] }, page: { size: 30 }, row: { id: "id", title: "id" } },
            source: definePort<ListSource<unknown>>("sales.leads-list"),
        }),
    ],
    actions: [
        {
            entry: "action",
            id: "sales.move-stage",
            operation: "moveStage",
            permission: "sales.manage",
            label: { key: "sales.move" },
        },
    ],
    specs: [
        {
            schema: "nivo/workbench-spec@1",
            module: "sales",
            views: [
                { id: "pipeline", label: { key: "sales.pipeline" }, root: { id: "root", block: "core.stack" } },
                { id: "orders", label: { key: "sales.orders" }, root: { id: "root", block: "core.stack" } },
            ],
        },
    ],
}

const LOYALTY: ModuleDeclaration = {
    entry: "module",
    key: "loyalty",
    namespace: "loyalty",
    permissions: [],
    reads: [],
    actions: [],
    specs: [],
}

describe("installationFactsOf", () => {
    let installationFactsOf: Subject["installationFactsOf"]

    beforeAll(async () => {
        ;({ installationFactsOf } = await build())
    })

    it("describes each module by its permissions, read and action ids, and the views of its seed specs", () => {
        const facts = installationFactsOf([SALES, LOYALTY], "hash-1", ["sales"])

        expect(facts).toEqual({
            registryHash: "hash-1",
            modules: [
                {
                    key: "sales",
                    permissions: ["sales.view", "sales.manage"],
                    reads: ["sales.leads"],
                    actions: ["sales.move-stage"],
                    views: ["pipeline", "orders"],
                },
                { key: "loyalty", permissions: [], reads: [], actions: [], views: [] },
            ],
            enabled: ["sales"],
        })
    })
})
