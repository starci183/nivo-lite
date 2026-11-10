import { builder } from "@starci/jest-preset"
import { inboxLeadsEntities } from "@modules/domain/inbox-leads"

const WebsiteSiteEntity: (typeof inboxLeadsEntities)[0] = inboxLeadsEntities[0]

/** The workspace a website site of a spec belongs to. */
export const WEBSITE_WORKSPACE = "11111111-1111-4111-8111-111111111111"

/** The agent a website site of a spec hands its customers to. */
export const WEBSITE_AGENT = "44444444-4444-4444-8444-444444444444"

/** The public key of the website site of a spec. */
export const WEBSITE_KEY = "abcdef0123456789abcdef01"

/** One stored website intake: on, with the form and the chat button showing; a spec states only the fields it varies. */
export const websiteSite: (
    overrides?: Partial<InstanceType<typeof WebsiteSiteEntity>>,
) => InstanceType<typeof WebsiteSiteEntity> = builder<InstanceType<typeof WebsiteSiteEntity>>({
    id: "site-1",
    workspaceId: WEBSITE_WORKSPACE,
    siteKey: WEBSITE_KEY,
    isEnabled: true,
    chatEnabled: true,
    formEnabled: true,
    pricesEnabled: false,
    agentId: WEBSITE_AGENT,
    createdAt: new Date("2026-11-09T07:00:00.000Z"),
    updatedAt: new Date("2026-11-09T07:00:00.000Z"),
})
