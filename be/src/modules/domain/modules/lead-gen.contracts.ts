import { MODULE_AUDIENCES } from "@modules/domain/module-audiences"
import { catalogCopy, catalogList, catalogText } from "./policies/catalog-copy.policy"
import { LEAD_GEN_ACTIONS, LEAD_GEN_COMMANDS } from "./lead-gen-flow.contracts"
import { LEAD_GEN_GATES } from "./lead-gen-gates.contracts"
import type { ModuleDefinition } from "./modules.contracts"

/** The lead_gen module: its copy and agent; the gates and the authority flow live beside it. */
export const LEAD_GEN_MODULE: ModuleDefinition = {
    key: "lead_gen",
    order: 15,
    name: catalogText("modulesCatalog.lead_gen.name"),
    shortName: catalogText("modulesCatalog.lead_gen.shortName"),
    description: catalogText("modulesCatalog.lead_gen.description"),
    points: catalogList([
        "modulesCatalog.lead_gen.points.0",
        "modulesCatalog.lead_gen.points.1",
        "modulesCatalog.lead_gen.points.2",
    ]),
    purpose: catalogCopy("modulesCatalog.lead_gen.purpose", "en"),
    icon: "community",
    glyph: "M4 5h16l-6 8v6l-4-2v-4z",
    mascot: "/images/promo/mascot-chat.png",
    category: "sales_customer",
    status: "early",
    audience: MODULE_AUDIENCES.lead_gen,
    includedWithWorkspace: false,
    available: true,
    knowledgeFolder: "lead_gen",
    workbench: "lead_gen",
    settingsExtras: null,
    requires: {
        capabilities: [],
        connections: ["meta"],
    },
    connectionProviders: ["meta"],
    defaultOperatingMode: "assist",
    multiInstance: true,
    agent: {
        name: catalogCopy("modulesCatalog.lead_gen.agent.name", "en"),
        handle: "leadgen",
        summary: catalogText("modulesCatalog.lead_gen.agent.summary"),
        capabilities: catalogList([
            "modulesCatalog.lead_gen.agent.capabilities.0",
            "modulesCatalog.lead_gen.agent.capabilities.1",
            "modulesCatalog.lead_gen.agent.capabilities.2",
            "modulesCatalog.lead_gen.agent.capabilities.3",
            "modulesCatalog.lead_gen.agent.capabilities.4",
        ]),
        role: catalogText("modulesCatalog.lead_gen.agent.role"),
        instructions: catalogText("modulesCatalog.lead_gen.agent.instructions"),
    },
    gates: LEAD_GEN_GATES,
    authorityActions: LEAD_GEN_ACTIONS,
    accepts: LEAD_GEN_COMMANDS,
}
