import type { ModuleServer, ModuleTemplate } from "@nivo-lite/agent-sdk/module"
import { LEAD_GEN_COPY as copy } from "./copy"
import { LEAD_GEN_GATES } from "./lead-gen-gates"

/** The lead_gen module: its copy and agent; the gates live beside it. */
export const LEAD_GEN_TEMPLATE: ModuleTemplate = {
    key: "lead_gen",
    order: 15,
    name: copy.text("name"),
    shortName: copy.text("shortName"),
    description: copy.text("description"),
    points: copy.list(["points.0", "points.1", "points.2"]),
    purpose: copy.one("purpose", "en"),
    icon: "community",
    glyph: "M4 5h16l-6 8v6l-4-2v-4z",
    mascot: "/images/promo/mascot-chat.png",
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
    agent: {
        label: copy.text("agent.label"),
        handle: "leadgen",
        summary: copy.text("agent.summary"),
        capabilities: copy.list([
            "agent.capabilities.0",
            "agent.capabilities.1",
            "agent.capabilities.2",
            "agent.capabilities.3",
            "agent.capabilities.4",
        ]),
        role: copy.text("agent.role"),
        instructions: copy.text("agent.instructions"),
    },
    gates: LEAD_GEN_GATES,
}

/** The lead gen module as the catalogue lists it: its template, read by the host through the installation. */
export const LEAD_GEN_SERVER: ModuleServer = { key: "lead_gen", template: LEAD_GEN_TEMPLATE }
