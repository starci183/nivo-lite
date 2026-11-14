import { builder } from "@starci/jest-preset"
import { definePlugin, type Plugin } from "@nivo-lite/agent-sdk/installation"
import { defineTool, type ToolDefinition } from "@nivo-lite/agent-sdk/node"
import { z } from "zod"
import type { OpenApiToolsPinView } from "@modules/domain/data-hub"
import { jsonBodySchema } from "@modules/platform/primitives"

/** The CRM id the CRM fixture plugin is written against (fixed, like a package's: a shop's own CRM, not the installed one). */
export const CRM_SOURCE = "acme"

/** Its provider key, as an account of it holds it. */
export const CRM_PROVIDER = "crm.acme"

/** One read tool of the CRM fixture plugin, by id. */
const readTool = (id: `nivo.api.crm.acme.${string}`): ToolDefinition =>
    defineTool({
        id,
        title: { en: id, vi: id },
        args: z.record(z.string().max(500), jsonBodySchema).refine((args) => Object.keys(args).length <= 100),
        result: jsonBodySchema,
        mutates: false,
    })

/**
 * A plugin that works with a CRM through its pinned OpenAPI document: it declares the CRM `acme` (customers) and two operation tools of it,
 * `nivo.api.crm.acme.get.customers.code` and `nivo.api.crm.acme.get.customers.code.balance` (names the pinned document gives, never typed by a
 * node author). For the specs that read the installed sources through the plugin registry (mock `@nivo-lite/plugin-registry` with it beside
 * the core plugin).
 */
export const CRM_SOURCE_PLUGIN: Plugin = definePlugin({
    key: "crm-fixture",
    label: { vi: "CRM", en: "CRM" },
    providers: [
        {
            kind: "crm",
            id: CRM_SOURCE,
            label: { vi: "CRM", en: "CRM" },
            openapi: { openapi: "3.1.0", paths: {} },
            swaggerPath: "/openapi.json",
            auth: { type: "bearer" },
            baseUrlHint: "https://crm.example.test",
        },
    ],
    tools: [readTool("nivo.api.crm.acme.get.customers.code"), readTool("nivo.api.crm.acme.get.customers.code.balance")],
})

/** A pin under the CRM `crm.acme` that serves one read opened to customers and one unmarked write. */
export const pinViewOf: (overrides?: Partial<OpenApiToolsPinView>) => OpenApiToolsPinView =
    builder<OpenApiToolsPinView>({
        connector: CRM_PROVIDER,
        swaggerUrl: "https://crm.example.test/v1/openapi.json",
        workspaceHeader: "X-Workspace-Id",
        live: false,
        documentSha256: "a".repeat(64),
        pinnedAt: "2026-11-12T08:00:00.000Z",
        tools: [
            {
                tool: "nivo.api.crm.acme.get.customers.code",
                state: "ready",
                unsupported: [],
                method: "GET",
                path: "/v1/customers/{code}",
                effect: null,
            },
            {
                tool: "nivo.api.crm.acme.post.tickets",
                state: "ready",
                unsupported: [],
                method: "POST",
                path: "/v1/tickets",
                effect: null,
            },
        ],
        audiences: [
            { tool: "nivo.api.crm.acme.get.customers.code", customerAudience: true, customerParameter: "code" },
            { tool: "nivo.api.crm.acme.post.tickets", customerAudience: false, customerParameter: null },
        ],
        undeclared: [],
    })
