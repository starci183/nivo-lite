import type { WebsiteChannelView } from "@/modules/types"

/** The website intake as the back end answers it (the read and the save answer this shape). */
export interface WebsiteSite {
    readonly isEnabled: boolean
    readonly chatEnabled: boolean
    readonly formEnabled: boolean
    readonly pricesEnabled: boolean
    readonly agentId: string | null
    readonly formUrl: string
}

/** The iframe that shows the hosted form inside the page of the shop. */
export const embedSnippetOf = (formUrl: string): string =>
    `<iframe src="${formUrl}" width="100%" height="460" loading="lazy" style="border:0"></iframe>`

/** The channel the card draws from the intake the API answered; every value is the API's. */
export const websiteChannelOf = (site: WebsiteSite): WebsiteChannelView => ({
    isEnabled: site.isEnabled,
    chatOn: site.chatEnabled,
    formOn: site.formEnabled,
    pricesOn: site.pricesEnabled,
    agentId: site.agentId,
    formUrl: site.formUrl,
    snippet: embedSnippetOf(site.formUrl),
})

/** The same shape with no words: the card keeps its ready tree while the read waits. */
export const WEBSITE_CHANNEL_PLACEHOLDER: WebsiteChannelView = {
    isEnabled: false,
    chatOn: false,
    formOn: false,
    pricesOn: false,
    agentId: null,
    formUrl: "",
    snippet: "",
}
