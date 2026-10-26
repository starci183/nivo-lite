import { LEAD_GEN_ACTIONS, LEAD_GEN_COMMANDS } from "./lead-gen-flow"
import { LEAD_GEN_GATES } from "./lead-gen-gates"
import type { ModuleDef } from "./catalog.types"

/** The lead_gen module. */
export const LEAD_GEN = {
    key: "lead_gen",
    order: 15,
    icon: "community",
    glyph: "moduleLeadGen",
    mascot: "/images/agents/lead_gen.png",
    category: "sales_customer",
    status: "early",
    audience: "customer",
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
    gates: LEAD_GEN_GATES,
    authorityActions: LEAD_GEN_ACTIONS,
    accepts: LEAD_GEN_COMMANDS,
} satisfies ModuleDef
