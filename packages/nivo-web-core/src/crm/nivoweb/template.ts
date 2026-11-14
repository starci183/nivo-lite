import { defineProviderTemplate, type ProviderTemplate } from "@nivo-lite/agent-sdk/installation"
import openapi from "./openapi.json"

/**
 * NIVO Web's CRM, the one CRM this package is written against (owner decision 2026-11-14): its id `nivoweb` is declared HERE only; the
 * document the package pins beside this file is the one its operation constants (`api.generated.ts`) are generated from, and the one a
 * live system's document is checked against when a shop connects it. The CRM serves its document at `/openapi.json` under its API base URL
 * and takes a bearer service credential (`serviceKey`, issued per enterprise workspace by the CRM's `cli credential issue`).
 */
export const NIVOWEB_CRM: ProviderTemplate = defineProviderTemplate({
    kind: "crm",
    id: "nivoweb",
    label: { vi: "CRM NIVO Web", en: "NIVO Web CRM" },
    openapi,
    swaggerPath: "/openapi.json",
    auth: { type: "bearer" },
    baseUrlHint: "https://crm.nivoweb.vn",
})
