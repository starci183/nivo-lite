import { PROVIDER } from "@nivo-lite/agent-sdk/names"
import { INSTALLED } from "./installed.policy"
import {
    WEBSITE_CHANNEL,
    bankFeedProviders,
    channelsOfTrigger,
    chatFrontDoorModulesOf,
    customerChannelProviders,
    frontDoorModulesOf,
    inboundChannelsOf,
    installedChatFrontDoors,
    installedFrontDoorsOf,
    type ChannelAgent,
} from "./installed-channels.policy"

const agentOf = (
    key: string,
    ...verbs: ReadonlyArray<readonly [string, ReadonlyArray<"zalo_oa" | "telegram" | "meta"> | undefined]>
): ChannelAgent => ({
    key,
    accounts: [],
    graphs: [{ spec: { triggers: verbs.map(([verb, accounts]) => ({ verb, accounts })) } }],
})

const zalo = ["nivo.trigger.zalo.message.received", ["zalo_oa"]] as const
const telegram = ["nivo.trigger.telegram.message.received", ["telegram"]] as const
const never = (): boolean => false

describe("channelsOfTrigger", () => {
    it("reads the channel of a customer-message verb from the trigger registry", () => {
        expect(channelsOfTrigger("nivo.trigger.zalo.message.received", ["zalo_oa"])).toEqual(["zalo_oa"])
        expect(channelsOfTrigger("nivo.trigger.telegram.message.received", ["telegram"])).toEqual(["telegram"])
        expect(channelsOfTrigger("nivo.trigger.facebook.message.received", ["meta"])).toEqual(["meta"])
        expect(channelsOfTrigger("nivo.trigger.website.message.received", undefined)).toEqual([WEBSITE_CHANNEL])
    })

    it("gives no channel to a verb that is no customer message", () => {
        expect(channelsOfTrigger("nivo.trigger.mail.message.received", [PROVIDER.imap])).toEqual([])
        expect(channelsOfTrigger("nivo.trigger.chat.message.received", undefined)).toEqual([])
        expect(channelsOfTrigger("nivo.trigger.workflow.called", undefined)).toEqual([])
        expect(channelsOfTrigger("not.a.verb", undefined)).toEqual([])
    })

    it("gives no channel for a provider the verb is not served through", () => {
        expect(channelsOfTrigger("nivo.trigger.zalo.message.received", ["telegram"])).toEqual([])
    })
})

describe("channel facts of the registry", () => {
    it("names the providers a customer writes on and the providers that feed bank credits", () => {
        expect([...customerChannelProviders()].toSorted()).toEqual(["meta", "telegram", "zalo_oa"])
        expect([...bankFeedProviders()].toSorted()).toEqual(["casso", "payos", "sepay"])
    })

    it("lists the channels a template agent wakes on a customer message of", () => {
        expect([...inboundChannelsOf(agentOf("front", zalo, telegram))].toSorted()).toEqual(["telegram", "zalo_oa"])
        expect(inboundChannelsOf(agentOf("none", ["nivo.trigger.clock.tick", undefined])).size).toBe(0)
    })
})

describe("frontDoorModulesOf", () => {
    it("lists the template agents that wake on the channel in the installation's order", () => {
        const agents = [agentOf("sales", zalo), agentOf("chatbot", zalo, telegram), agentOf("booking", telegram)]

        expect(frontDoorModulesOf("zalo_oa", agents, never)).toEqual(["sales", "chatbot"])
        expect(frontDoorModulesOf("telegram", agents, never)).toEqual(["chatbot", "booking"])
        expect(frontDoorModulesOf("meta", agents, never)).toEqual([])
    })

    it("puts a private plugin's template before the public ones, each group in the installation's order", () => {
        const agents = [
            agentOf("chatbot", zalo),
            agentOf("webdesk", zalo),
            agentOf("sales", zalo),
            agentOf("webx", zalo),
        ]

        expect(frontDoorModulesOf("zalo_oa", agents, (module) => module.startsWith("web"))).toEqual([
            "webdesk",
            "webx",
            "chatbot",
            "sales",
        ])
    })
})

describe("the installed front doors", () => {
    it("makes the company's own template the first front door of Zalo and the shared chatbot the first of Telegram", () => {
        expect(installedFrontDoorsOf("zalo_oa")).toEqual(["webdesk", "chatbot"])
        expect(installedFrontDoorsOf("telegram")).toEqual(["chatbot"])
        expect(installedFrontDoorsOf("meta")).toEqual(["chatbot"])
    })

    it("reads the website's front door from the installation", () => {
        expect(installedFrontDoorsOf(WEBSITE_CHANNEL).length).toBeGreaterThan(0)
        expect(INSTALLED.templateAgents().length).toBeGreaterThan(0)
    })
})

describe("the customer chat front doors", () => {
    const website = ["nivo.trigger.website.message.received", undefined] as const

    it("lists the template agents that answer a customer on a provider channel, the one that answers more channels first", () => {
        const agents = [
            agentOf("sales", website, zalo),
            agentOf("chatbot", zalo, telegram),
            agentOf("booking", telegram),
        ]

        expect(chatFrontDoorModulesOf(agents, never)).toEqual(["chatbot", "sales", "booking"])
    })

    it("leaves out an agent that only answers the website form, and puts a private plugin's template first", () => {
        const agents = [agentOf("sales", website), agentOf("chatbot", zalo, telegram), agentOf("webdesk", zalo)]

        expect(chatFrontDoorModulesOf(agents, (module) => module === "webdesk")).toEqual(["webdesk", "chatbot"])
    })

    it("reads the installation: the shared chatbot answers more channels than any other template", () => {
        expect(installedChatFrontDoors()).toContain("chatbot")
        expect(installedChatFrontDoors()).not.toContain("sales")
    })
})
