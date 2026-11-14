import { PROVIDER } from "@nivo-lite/agent-sdk/names"
import type { Mode, TemplateAgent } from "@nivo-lite/agent-sdk/template"
import { chatbotModule } from "../../agents/chatbot"
import { chatbotAgent } from "../../agents/chatbot/graphs/chatbot.agent"
import { salesModule } from "../../agents/sales"
import { salesAgent } from "../../agents/sales/graphs/sales.agent"

/**
 * The providers the host knows, by kind (`be/src/modules/domain/mcp-gateway/provider-abilities.policy.ts`, `PROVIDER_CATALOGUE`).
 * `nivo` (NIVO's own pseudo-account) is always the agent's and never listed by a template agent, so it is not here.
 */
const KNOWN_PROVIDERS: Readonly<Record<string, ReadonlyArray<string>>> = {
    messaging: [PROVIDER.zaloOa, PROVIDER.telegram, PROVIDER.meta],
    payment: [PROVIDER.sepay, PROVIDER.casso, PROVIDER.payos],
    books: [PROVIDER.google],
    mail: [PROVIDER.smtp, PROVIDER.imap],
}

/** The messaging providers, in the order the census lists them (§7). */
const MESSAGING = [PROVIDER.zaloOa, PROVIDER.telegram, PROVIDER.meta] as const

/** The stricter of two modes (`ask` wins over `auto`); `null` is no step yet. */
const stricter = (kept: Mode | null, mode: Mode): Mode => (kept === "ask" || mode === "ask" ? "ask" : "auto")

/** What a template agent reaches: the modes by provider, the agent's own tools and the providers it does not list. */
interface AgentReach {
    readonly providers: Readonly<Record<string, Mode | null>>
    readonly own: Readonly<Record<string, Mode>>
    readonly unlisted: ReadonlyArray<string>
}

/**
 * The reach of a template agent at the level of its steps (`nivo-frame.rights`: the engine attaches a fresh agent to every working
 * account of each provider it lists, `providersOfTemplateAgent` in the back end, which this package cannot import; each node step declares
 * its ONE mode): for each provider the agent lists (its order kept), the strictest mode of the node steps that act through it (`ask` wins
 * over `auto`), as a summary of the template's steps only, never a stored right; a listed provider no step acts through is `null` (still
 * attached). A step that acts through no provider (NIVO's own tools: always the agent's, always bound, never listed) is gathered under
 * `own`, by its node, with the strictest mode of its steps. A step provider the agent does NOT list is gathered under `unlisted` (it could
 * never be attached).
 */
const reachOf = (agent: TemplateAgent): AgentReach => {
    const providers = new Map<string, Mode | null>(agent.accounts.map((provider) => [provider, null]))
    const own = new Map<string, Mode>()
    const unlisted: Array<string> = []
    for (const graph of agent.graphs) {
        for (const step of graph.spec.nodes) {
            if (step.kind !== "node") continue
            if (step.accounts.length === 0) own.set(step.step, stricter(own.get(step.step) ?? null, step.mode))
            for (const provider of step.accounts) {
                const kept = providers.get(provider)
                if (kept === undefined) {
                    unlisted.push(`${graph.key}#${step.key} ${provider}`)
                    continue
                }
                providers.set(provider, stricter(kept, step.mode))
            }
        }
    }
    return { providers: Object.fromEntries(providers), own: Object.fromEntries(own), unlisted }
}

const AGENTS = [
    [chatbotModule, chatbotAgent],
    [salesModule, salesAgent],
] as const

describe("the default rights of a fresh agent on connected providers", () => {
    it.each(AGENTS.map(([module, agent]) => [module.key, module, agent] as const))(
        "%s: its template agent lists known providers only, each step mode auto or ask, and the module's agent holds only its tool set",
        (_key, module, agent) => {
            // Since the flip a module declares no ability table: the template agent's accounts and its node steps are its whole reach.
            expect(module.agent?.abilities).toBeUndefined()
            expect(agent.key).toBe(module.key)
            const known = Object.values(KNOWN_PROVIDERS).flat()
            expect(agent.accounts.length).toBeGreaterThan(0)
            for (const provider of agent.accounts) expect([provider, known.includes(provider)]).toEqual([provider, true])
            const { providers, own, unlisted } = reachOf(agent)
            expect(unlisted).toEqual([])
            for (const mode of [...Object.values(providers), ...Object.values(own)]) expect(mode).toMatch(/^(auto|ask)$/u)
            expect(Object.keys(module.agent ?? {}).sort()).toEqual(["tools"])
        },
    )

    it("gives the chatbot by itself only its core work: the customer send, auto, on every messaging provider", () => {
        expect(chatbotAgent.accounts).toEqual([...MESSAGING])
        expect(reachOf(chatbotAgent).providers).toEqual(Object.fromEntries(MESSAGING.map((provider) => [provider, "auto"])))
        // NIVO's own steps (no provider): the hearing, the reading, the team posts, the team chat and the proposal, each declared `auto`. The
        // front desk (v24+) opens on `chatbot.hear` (it reads the engine's own conversation: no provider, auto), so the hearing is now an own step.
        expect(reachOf(chatbotAgent).own).toEqual({
            "chatbot.hear": "auto",
            "chatbot.understand": "auto",
            "chatbot.complaint-notify": "auto",
            "team.chat": "auto",
            // front desk v26 (R68, G-SLIM): the declined-notice steps are gone (the ENGINE tells the team), so the chatbot no longer places
            // `team.declined-notice` (P-NEXT: spec followed the graph; the post count is unchanged, the engine posts it).
            "team.truth-propose": "auto",
            "team.answer-post": "auto",
        })
    })

    it("gives the sales agent the customer send, auto, on every messaging provider, and the bank feed's credit read, auto", () => {
        // The money in (`sales.payment`) reads the credit the bank trigger names on the SePay, Casso or payOS account: a read, auto.
        expect(reachOf(salesAgent).providers).toEqual({
            ...Object.fromEntries(MESSAGING.map((provider) => [provider, "auto"])),
            sepay: "auto",
            casso: "auto",
            payos: "auto",
        })
        // NIVO's own: every own step is `auto`, the order cancel included (the graph cancels only an order that is not paid).
        const own = reachOf(salesAgent).own
        expect(own["sales.order-cancel"]).toBe("auto")
        expect(Object.entries(own).filter(([, mode]) => mode === "ask")).toEqual([])
    })
})
