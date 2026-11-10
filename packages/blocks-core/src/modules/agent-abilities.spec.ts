import { accountingModule } from "./accounting"
import { chatbotModule } from "./chatbot"
import { salesModule } from "./sales"

/** The provider kinds the host knows (`be/src/modules/domain/mcp-gateway/provider-abilities.policy.ts`). */
const KINDS = ["messaging", "payment", "books"]

const AGENTS = [chatbotModule, salesModule, accountingModule]

describe("the default rights of a fresh agent on connected providers", () => {
    it.each(AGENTS.map((module) => [module.key, module] as const))(
        "%s: declares abilities by a known kind, each off, auto or ask, beside its policy and never inside it",
        (_key, module) => {
            const kinds = Object.entries(module.agent?.abilities?.kinds ?? {})
            expect(kinds.length).toBeGreaterThan(0)
            for (const [kind, abilities] of kinds) {
                expect([kind, KINDS.includes(kind)]).toEqual([kind, true])
                for (const mode of Object.values(abilities)) expect(mode).toMatch(/^(off|auto|ask)$/u)
            }
            expect(Object.keys(module.agent?.policy ?? {}).sort()).toEqual(["guidance", "limits"])
        },
    )

    it("gives each agent by itself only its core work", () => {
        expect(chatbotModule.agent?.abilities).toEqual({
            kinds: { messaging: { "customer.send": "auto" } },
        })
        expect(salesModule.agent?.abilities).toEqual({
            kinds: {
                messaging: { "customer.send": "auto" },
                payment: { "qr.create": "auto" },
            },
        })
        expect(accountingModule.agent?.abilities).toEqual({
            kinds: {
                messaging: { "customer.send": "auto" },
                payment: { "transactions.read": "auto", "credit.rematch": "auto" },
                books: { "ledger.read": "auto", "ledger.write": "auto" },
            },
        })
    })
})
