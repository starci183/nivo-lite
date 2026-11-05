import { moduleListProblems, seedSpecProblems } from "@nivo-lite/agent-sdk/module"
import { specProblems } from "@nivo-lite/agent-sdk/workbench/spec"
import type { WorkbenchSpecDocument } from "@nivo-lite/agent-sdk/workbench/spec"
import { coreBlocks } from "../blocks/core-blocks"
import { MODULE_DECLARATIONS } from "./module-declarations"
import { REGISTERED_MODULE_KEYS } from "./registered-module-keys"
import { MODULE_SERVERS } from "./module-servers"
import { MODULE_WORKBENCHES } from "./module-workbenches"
import { SPEC_REGISTRY } from "./spec-registry"

describe("the module registry", () => {
    it("lists a server list the host may load", () => {
        expect(moduleListProblems(MODULE_SERVERS)).toEqual([])
    })

    it("lists the key of every server", () => {
        expect(REGISTERED_MODULE_KEYS).toEqual(["loyalty"])
    })

    it("gives every module with a workbench key one workbench declaration under that key", () => {
        const keys = MODULE_SERVERS.flatMap((module) =>
            module.template.workbench === null ? [] : [module.template.workbench],
        )
        expect(MODULE_WORKBENCHES.map((workbench) => workbench.key)).toEqual(keys)
    })
})

/** The example of the SDK README: a Loyalty overview recomposed from SDK blocks and the board reads Loyalty exposes. */
const LOYALTY_OVERVIEW: WorkbenchSpecDocument = {
    schema: "nivo/workbench-spec@1",
    module: "loyalty",
    views: [
        {
            id: "overview",
            label: { key: "tab_overview" },
            root: {
                id: "root",
                block: "stack",
                props: { gap: "region" },
                children: [
                    { id: "waiting", block: "waiting" },
                    {
                        id: "figures",
                        block: "figures",
                        props: { label: { key: "figuresLabel" } },
                        bind: { data: { read: "loyalty.figures", path: "figures" } },
                        children: [
                            { id: "members", block: "figure", props: { term: { key: "members" }, path: "members" } },
                        ],
                    },
                    {
                        id: "list",
                        block: "record-list",
                        props: {
                            label: { vi: "Regulars in vi", en: "Regulars" },
                            empty: { key: "membersEmpty" },
                            idPath: "id",
                            titlePath: "name",
                            badgePath: "tier",
                        },
                        bind: { rows: { read: "loyalty.members", path: "members" } },
                    },
                    { id: "cards", block: "dashboard-cards" },
                ],
            },
        },
    ],
}

describe("SPEC_REGISTRY", () => {
    it("admits a Loyalty screen composed from SDK blocks and Loyalty's exposed reads", () => {
        expect(specProblems(LOYALTY_OVERVIEW, SPEC_REGISTRY)).toEqual([])
    })

    it("refuses the same screen bound to a board path Loyalty does not expose", () => {
        const [view] = LOYALTY_OVERVIEW.views
        const document: WorkbenchSpecDocument = {
            ...LOYALTY_OVERVIEW,
            views:
                view === undefined
                    ? []
                    : [
                          {
                              ...view,
                              root: {
                                  id: "x",
                                  block: "figures",
                                  props: { label: { key: "a" } },
                                  bind: { data: { read: "loyalty.figures", path: "program" } },
                              },
                          },
                      ],
        }
        expect(specProblems(document, SPEC_REGISTRY)).toEqual([{ code: "SPEC_BINDING_UNKNOWN", at: "overview/x.data" }])
    })
})

describe("MODULE_DECLARATIONS", () => {
    it("holds declarations whose seed specs draw with the core blocks and their own reads and actions", () => {
        expect(MODULE_DECLARATIONS.flatMap((declaration) => seedSpecProblems(declaration, coreBlocks))).toEqual([])
    })

    it("holds each module key once", () => {
        const keys = MODULE_DECLARATIONS.map((declaration) => declaration.key)
        expect(new Set(keys).size).toBe(keys.length)
    })
})
