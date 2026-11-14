import { crmProviderKeyOf } from "@nivo-lite/agent-sdk/names"
import type { ProviderTemplate } from "@nivo-lite/agent-sdk/installation"
import { INSTALLED } from "@modules/domain/installed-plugins"
import { sourcePrefixOf } from "./openapi-document.policy"
import type { OpenApiAbility, OpenApiToolDeclaration } from "./openapi-tools.contracts"

/** The connection kind of a CRM connected through its OpenAPI document: one row of `connections` per CRM, its id in the pin's facts. */
export const OPENAPI_PROVIDER = "openapi"

/**
 * The CRM templates the installed plugins declare (`defineProviderTemplate`, kind `crm`), in installation order: the id, the pinned
 * document, where a live system serves its document, how its key is sent. The CRM id lives only there, never in the engine.
 */
export const CRM_TEMPLATES: ReadonlyArray<ProviderTemplate> = INSTALLED.providers().filter((template) => template.kind === "crm")

/** The CRM template of a provider key (`crm.nivoweb`), or null when no installed package declares it (a shop's own CRM). */
export const crmTemplateOf = (providerKey: string): ProviderTemplate | null =>
    CRM_TEMPLATES.find((template) => crmProviderKeyOf(template.id) === providerKey) ?? null

/**
 * Whether a CRM template is open to a workspace (its enterprise identifier, null for an ordinary workspace): as the plugin that declares it
 * is (a public plugin to every workspace, a private one only to the enterprises it names). A template no plugin declares is closed.
 */
export const crmTemplateOpenTo = (templateId: string, enterpriseKey: string | null): boolean => {
    const plugin = INSTALLED.plugins.find((one) => one.providers.includes(templateId))
    if (plugin === undefined) return false
    return plugin.visibility === "public" || (enterpriseKey !== null && plugin.enterprises.includes(enterpriseKey))
}

/** The provider keys of those CRMs (`crm.nivoweb`): what a node lists in `accounts` and what an account's pin serves. */
export const OPENAPI_SOURCE_KEYS: ReadonlyArray<string> = CRM_TEMPLATES.map((template) => crmProviderKeyOf(template.id))

/** What a plugin declares of one tool, as far as the provider reads it. */
export interface DeclaredTool {
    /** The tool id. */
    readonly id: string
    /** True when a call changes the world. */
    readonly mutates: boolean
}

/**
 * The operations of one CRM (provider key `crm.<id>`) among the declared tools: a tool belongs to it exactly when its id starts with
 * `nivo.api.crm.<id>.` (a generated constant of the plugin's pinned document), named inside the connector by the rest of its id. The rule
 * is static, so the rights catalogue, a pin view and the compatibility check list the same operations whatever document an account
 * pinned: a declared operation the pinned document does not serve is `missing`, never absent.
 */
export const declarationsOf = (source: string, tools: ReadonlyArray<DeclaredTool>): ReadonlyArray<OpenApiToolDeclaration> => {
    const prefix = sourcePrefixOf(source)
    return tools
        .filter((tool) => tool.id.startsWith(prefix))
        .map((tool) => ({ tool: tool.id, connector: source, name: tool.id.slice(prefix.length), reads: !tool.mutates }))
}

/**
 * The abilities of the provider: ONE per declared operation. The ability id is the operation's name (`nivo.api.crm.nivoweb.get.prices`):
 * it comes from the plugin's declaration, so it stays the same across re-pins.
 */
export const openApiAbilitiesOf = (declarations: ReadonlyArray<OpenApiToolDeclaration>): ReadonlyArray<OpenApiAbility> =>
    declarations.map((declaration) => ({
        id: declaration.tool,
        scope: declaration.reads ? "read" : "write",
        tools: [declaration.tool],
    }))

/** The operations the installed plugins declare on one CRM (provider key `crm.<id>`): what a connection of it must serve. */
export const installedDeclarationsOf = (source: string): ReadonlyArray<OpenApiToolDeclaration> =>
    declarationsOf(source, INSTALLED.nodeInstall().tools)

/** The abilities of the provider over every operation the installed plugins declare on their CRMs. */
export const INSTALLED_OPENAPI_ABILITIES: ReadonlyArray<OpenApiAbility> = openApiAbilitiesOf(
    OPENAPI_SOURCE_KEYS.flatMap((source) => installedDeclarationsOf(source)),
)
