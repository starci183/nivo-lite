import { builder } from "@starci/jest-preset"
import { agentTemplatesEntities } from "@modules/domain/agent-templates"
import { templateMarketplaceEntities } from "@modules/domain/template-marketplace"
import { CREATOR, packageOf } from "./agent-template.builder"

const AgentTemplateEntity: (typeof agentTemplatesEntities)[0] = agentTemplatesEntities[0]
type AgentTemplateEntity = InstanceType<typeof AgentTemplateEntity>
const AgentTemplateVersionEntity: (typeof agentTemplatesEntities)[1] = agentTemplatesEntities[1]
type AgentTemplateVersionEntity = InstanceType<typeof AgentTemplateVersionEntity>
const TemplateInstallEntity: (typeof agentTemplatesEntities)[2] = agentTemplatesEntities[2]
type TemplateInstallEntity = InstanceType<typeof TemplateInstallEntity>
const TemplateLicenseEntity: (typeof agentTemplatesEntities)[3] = agentTemplatesEntities[3]
type TemplateLicenseEntity = InstanceType<typeof TemplateLicenseEntity>
const TemplateListingEntity: (typeof templateMarketplaceEntities)[2] = templateMarketplaceEntities[2]
type TemplateListingEntity = InstanceType<typeof TemplateListingEntity>

/** The moment every stored template row was written. */
export const ROW_AT: Date = new Date("2026-11-03T02:00:00.000Z")

/** The parameter values of an install row. */
export const INSTALL_VALUES: Record<string, string | number> = {
    autoLimit: 5_000_000,
    waitMinutes: 240,
    shop: "Spa Hoa",
}

/** The template spa-booking-by-linh of the creator, not first party. */
export const templateRow: (overrides?: Partial<AgentTemplateEntity>) => AgentTemplateEntity =
    builder<AgentTemplateEntity>(
        Object.assign(new AgentTemplateEntity(), {
            id: "template-1",
            key: "spa-booking-by-linh",
            creatorAccountId: CREATOR.accountId,
            baseModule: "accounting",
            name: { vi: "Dat lich spa", en: "Spa booking" },
            firstParty: false,
        }),
    )

/** The first version of the template spa-booking-by-linh. */
export const versionRow: (overrides?: Partial<AgentTemplateVersionEntity>) => AgentTemplateVersionEntity =
    builder<AgentTemplateVersionEntity>(
        Object.assign(new AgentTemplateVersionEntity(), {
            id: "row-1",
            templateId: "template-1",
            key: "spa-booking-by-linh",
            version: 1,
            package: packageOf(),
            hash: packageOf().hash,
            changelog: "First",
            breaking: false,
            createdAt: ROW_AT,
        }),
    )

/** The install of version 1 of the template by workspace ws-buyer under license-1. */
export const installRow: (overrides?: Partial<TemplateInstallEntity>) => TemplateInstallEntity =
    builder<TemplateInstallEntity>(
        Object.assign(new TemplateInstallEntity(), {
            installationId: "inst-1",
            workspaceId: "ws-buyer",
            templateKey: "spa-booking-by-linh",
            version: 1,
            parameterValues: INSTALL_VALUES,
            licenseId: "license-1",
        }),
    )

/** The free, active license license-1. */
export const licenseRow: (overrides?: Partial<TemplateLicenseEntity>) => TemplateLicenseEntity =
    builder<TemplateLicenseEntity>(
        Object.assign(new TemplateLicenseEntity(), { id: "license-1", kind: "free", status: "active" }),
    )

/** The draft listing of version 1 of the template, free, at the default share. */
export const listingRow: (overrides?: Partial<TemplateListingEntity>) => TemplateListingEntity =
    builder<TemplateListingEntity>(
        Object.assign(new TemplateListingEntity(), {
            id: "listing-1",
            templateKey: "spa-booking-by-linh",
            version: 1,
            status: "draft",
            priceVnd: 0,
            revenueSharePct: 70,
            checks: [],
            reviewNote: "",
            firstParty: false,
            updatedAt: ROW_AT,
        }),
    )
