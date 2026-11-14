import { defineInstallation } from "@nivo-lite/agent-sdk/installation"
import { defineWebhookEvent } from "@nivo-lite/agent-sdk/webhook"
import { installedPluginsOf } from "./installed-plugins.policy"

const event = (id: string, moduleKey: string) =>
    defineWebhookEvent({ id, label: { vi: `vi ${id}`, en: `en ${id}` }, moduleKey })

const WON = event("deal.won", "sales")
const CREATED = event("lead.created", "chatbot")

describe("installedPluginsOf webhook events", () => {
    it("lists the webhook events of every plugin, in installation order", () => {
        const installed = installedPluginsOf(defineInstallation([{ webhookEvents: [WON] }, { webhookEvents: [CREATED] }], "h"))
        expect(installed.webhookEvents()).toEqual([WON, CREATED])
    })

    it("lists none when nothing is installed or no plugin declares one", () => {
        expect(installedPluginsOf(defineInstallation([], "h")).webhookEvents()).toEqual([])
        expect(installedPluginsOf(defineInstallation([{}], "h")).webhookEvents()).toEqual([])
    })
})
