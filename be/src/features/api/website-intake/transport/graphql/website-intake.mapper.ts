import type { SaveWebsiteSiteRequest } from "../../application/save-website-site.contracts"
import type { SubmitWebsiteLeadRequest } from "../../application/submit-website-lead.contracts"
import type { SaveWebsiteSiteInput } from "./dto/save-website-site.input"
import type { SubmitWebsiteLeadInput } from "./dto/submit-website-lead.input"

/** Selects what the owner changed on the website intake; a field left out stays out. */
export const toSaveWebsiteSiteRequest = (workspaceId: string, input: SaveWebsiteSiteInput): SaveWebsiteSiteRequest => ({
    workspaceId,
    change: {
        isEnabled: input.isEnabled,
        chatEnabled: input.chatEnabled,
        formEnabled: input.formEnabled,
        pricesEnabled: input.pricesEnabled,
        agentId: input.agentId,
    },
})

/** Selects the form of an anonymous visitor under its site key. */
export const toSubmitWebsiteLeadRequest = (input: SubmitWebsiteLeadInput): SubmitWebsiteLeadRequest => ({
    siteKey: input.siteKey,
    submission: {
        name: input.name,
        phone: input.phone,
        email: input.email,
        message: input.message,
        pagePath: input.pagePath,
        campaign: input.campaign,
        device: input.device,
        visitor: input.visitor,
        submissionId: input.submissionId,
    },
})
