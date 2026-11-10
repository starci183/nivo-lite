/** Log events of the inbox-leads capability: ids and codes only, never what a visitor wrote. */
export enum InboxLeadsLogEvent {
    /** A website form woke its agent. */
    WebsiteLeadWoke = "inbox_leads.website_lead.woke",
    /** A website form was stored but no agent received it: the site has none and the workspace has no active Sales agent. */
    WebsiteLeadNoAgent = "inbox_leads.website_lead.no_agent",
    /** The wake of a website form was not written (a repeat, or a refused tag); the customer and the input are stored. */
    WebsiteLeadNotWoken = "inbox_leads.website_lead.not_woken",
}
