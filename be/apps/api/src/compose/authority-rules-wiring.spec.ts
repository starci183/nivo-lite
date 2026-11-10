import { AuthorityRuleNodePortService, ChatNodePortsModule } from "@modules/domain/chat-node-ports"
import { AuthorityRulesModule, AuthorityRulesService } from "@modules/domain/authority-rules"
import { DecisionsModule } from "@modules/domain/decisions"
import { DECISIONS_PORTS } from "../api.options"

describe("the permission level a graph node reads, in the api composition", () => {
    const decisions = DecisionsModule.register({ isGlobal: true, ports: DECISIONS_PORTS })

    it("reaches AuthorityRulesService app-wide: the authority-rules capability exports it and the global decisions module re-exports that capability", () => {
        const owner = AuthorityRulesModule.register({ isGlobal: false })
        const reExported = (decisions.exports ?? []).some(
            (entry) => typeof entry === "object" && "module" in entry && entry.module === AuthorityRulesModule,
        )

        expect(owner.exports).toContain(AuthorityRulesService)
        expect(decisions.global).toBe(true)
        expect(reExported).toBe(true)
    })

    it("serves the authority-rule data kind from the chat node ports", () => {
        const ports = ChatNodePortsModule.register({ isGlobal: true })

        expect(ports.providers).toContain(AuthorityRuleNodePortService)
    })
})
