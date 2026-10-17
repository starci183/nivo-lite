import { builder, mock, mockEntityManager } from "@starci/jest-preset"
import { Test } from "@nestjs/testing"
import { AuthorityService } from "@modules/domain/authority"
import type { AuthorityProfile } from "@modules/domain/authority"
import { AuthorityActionsService } from "@modules/domain/authority-actions"
import type { AuthorityActionRecord } from "@modules/domain/authority-actions"
import { AuthorityRulesService } from "@modules/domain/authority-rules"
import type { AuthorityRuleRecord } from "@modules/domain/authority-rules"
import { EvidenceService, ModuleCatalogService } from "@modules/domain/decisions"
import type { WorkspaceMember } from "@modules/domain/workspace-members"
import { DEEPSEEK_CLIENT } from "@modules/integrations/deepseek"
import type { DeepseekClient } from "@modules/integrations/deepseek"
import { PRIMARY_ENTITY_MANAGER } from "@modules/platform/database"
import { MESSAGE_CATALOG } from "@modules/platform/i18n"
import type { MessageCatalog } from "@modules/platform/i18n"
import { AuthorityChatService, moneyOf } from "./authority-chat.service"
import { FlowEngineErrorCode } from "./errors/flow-engine.error"

const registerRuleCards = () => {
    it("formats the amount on rule cards in the reader's language", () => {
        expect(moneyOf(5000, "vi")).toBe("5.000 \u0111")
        expect(moneyOf(5000, "en")).toBe("\u20ab5,000")
    })

    it("saves the order limit the owner named even when the model missed it", async () => {
        const { service, saveRule, decide, log } = await build()

        const answer = await service.apply(member, "don tren 20 trieu thi hoi toi", "vi")

        expect(saveRule).toHaveBeenCalledWith(
            "ws-1",
            expect.objectContaining({ action: "confirm_order", mode: "auto", limit_vnd: 20_000_000 }),
        )
        expect(answer.summary).toBe("flowEngine.authoritySaved")
        expect(decide).toHaveBeenCalledTimes(1)
        expect(log).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ kind: "authority.updated" }))
    })

    it("changes nothing when the message grants nothing", async () => {
        const { service, saveRule, saveSheet } = await build()

        const answer = await service.apply(member, "xin chao", "vi")

        expect(answer.summary).toBe("flowEngine.authorityNothing")
        expect(saveRule).not.toHaveBeenCalled()
        expect(saveSheet).not.toHaveBeenCalled()
    })
}

const registerAuthorityEdits = () => {
    it("saves rounded goals and appended authority text and logs the exact changes", async () => {
        const { service, parseAuthorityChat, authority, saveSheet, catalog, log, decide } = await build()
        const current = profileOf()
        const saved = profileOf({ policies: "Old policy\nDeposit", limits_note: "Old limit\nAsk before refunds" })
        authority.profileOf.mockResolvedValue(current)
        saveSheet.mockResolvedValue(saved)
        parseAuthorityChat.mockResolvedValue({
            ...NOTHING,
            goals: { revenue_vnd: 1000.6, new_customers: 3.6, first_reply_minutes: 2.4, note: " More repeat sales " },
            policies_add: ["Deposit"],
            reply_style: " Concise ",
            brand_voice: " Friendly ",
            limits_note_add: " Ask before refunds ",
        })

        const answer = await service.apply(member, "Our monthly goals", "en")

        expect(saveSheet).toHaveBeenCalledWith(
            "ws-1",
            {
                goal_revenue_vnd: 1001,
                goal_new_customers: 4,
                goal_first_reply_minutes: 2,
                goal_note: "More repeat sales",
                policies: "Old policy\nDeposit",
                reply_style: "Concise",
                brand_voice: "Friendly",
                limits_note: "Old limit\nAsk before refunds",
            },
            "An",
        )
        expect(answer).toEqual({ summary: "flowEngine.authoritySaved", authority: saved, rules: [ruleOf()] })
        expect(catalog.get).toHaveBeenCalledWith("flowEngine.goalRevenue", { amount: "\u20ab1,001" }, "en")
        expect(catalog.get).toHaveBeenCalledWith("flowEngine.goalCustomers", { n: 4 }, "en")
        expect(catalog.get).toHaveBeenCalledWith("flowEngine.goalReply", { n: 2 }, "en")
        expect(catalog.get).toHaveBeenCalledWith("flowEngine.policies", { n: 1 }, "en")
        expect(log).toHaveBeenCalledWith(
            { workspaceId: "ws-1", actor: "An", locale: "en" },
            {
                kind: "authority.updated",
                actor: "An",
                summary: "flowEngine.authorityDecisionNote",
                evidence: "Our monthly goals",
            },
        )
        expect(decide).not.toHaveBeenCalled()
    })

    it("starts policy and limit notes from an empty sheet and ignores a zero reply target", async () => {
        const { service, parseAuthorityChat, saveSheet } = await build()
        parseAuthorityChat.mockResolvedValue({
            ...NOTHING,
            goals: { revenue_vnd: 0, new_customers: 0, first_reply_minutes: 0 },
            policies_add: ["Deposit"],
            limits_note_add: " Ask before refunds ",
        })
        saveSheet.mockResolvedValue(profileOf())

        await expect(service.apply(member, "Policy", "vi")).resolves.toEqual({
            summary: "flowEngine.authoritySaved",
            authority: profileOf(),
            rules: [ruleOf()],
        })
        expect(saveSheet).toHaveBeenCalledWith(
            "ws-1",
            { goal_revenue_vnd: 0, goal_new_customers: 0, policies: "Deposit", limits_note: "Ask before refunds" },
            "An",
        )
    })
}

const registerGoalNotes = () => {
    it("stores a goal note even when it creates no summary line", async () => {
        const { service, parseAuthorityChat, saveSheet, log } = await build()
        parseAuthorityChat.mockResolvedValue({ ...NOTHING, goals: { note: " Focus " } })
        const saved = profileOf({ goal_note: "Focus" })
        saveSheet.mockResolvedValue(saved)

        await expect(service.apply(member, "Focus", "vi")).resolves.toEqual({
            summary: "flowEngine.authorityNothing",
            authority: saved,
            rules: [ruleOf()],
        })
        expect(saveSheet).toHaveBeenCalledWith("ws-1", { goal_note: "Focus" }, "An")
        expect(log).not.toHaveBeenCalled()
    })

    it("ignores unknown, unnamed, and unchanged rules and passes stored limits to the model", async () => {
        const { service, parseAuthorityChat, rules, saveRule, actionCatalog, entityManager } = await build([
            actionOf(),
            actionOf({ action: "send_quote" }),
        ])
        const stored = ruleOf({ limit_vnd: 5000 })
        rules.list.mockResolvedValue([stored])
        parseAuthorityChat.mockResolvedValue({
            ...NOTHING,
            rules: [
                { action: "unknown", mode: "auto" },
                { action: "send_quote", mode: "auto" },
                { action: "confirm_order" },
            ],
        })

        await expect(service.apply(member, "order", "en")).resolves.toEqual({
            summary: "flowEngine.authorityNothing",
            authority: null,
            rules: [stored],
        })
        expect(parseAuthorityChat).toHaveBeenCalledWith(
            { workspaceId: "ws-1", locale: "en" },
            "order",
            "confirm_order=ask(limit 5000)",
        )
        expect(actionCatalog.list).toHaveBeenCalledWith(entityManager)
        expect(saveRule).not.toHaveBeenCalled()
    })
}

const registerRuleSaving = () => {
    it("saves a new rule with defaults and records an absent before value", async () => {
        const { service, parseAuthorityChat, rules, saveRule, decide, catalog } = await build()
        rules.list.mockResolvedValue([])
        const saved = ruleOf({ mode: "ask", limit_vnd: null })
        saveRule.mockResolvedValue(saved)
        parseAuthorityChat.mockResolvedValue({ ...NOTHING, rules: [{ action: "confirm_order" }] })

        await expect(service.apply(member, "order", "en")).resolves.toEqual({
            summary: "flowEngine.authoritySaved",
            authority: null,
            rules: [],
        })
        expect(saveRule).toHaveBeenCalledWith("ws-1", {
            action: "confirm_order",
            department: "sales",
            mode: "ask",
            limit_vnd: null,
            required_fields: [],
            note: null,
        })
        expect(decide).toHaveBeenCalledWith(
            { workspaceId: "ws-1", actor: "An", locale: "en" },
            {
                work_item_id: null,
                lead_id: null,
                department: "sales",
                action: "confirm_order",
                decided_by: "An",
                decider_kind: "owner",
                outcome: "edited",
                note: "flowEngine.authorityDecisionNote",
                before: null,
                after: { summary: "confirm_order=ask", fields: { mode: "ask", limit_vnd: null } },
            },
        )
        expect(catalog.get).toHaveBeenCalledWith(
            "flowEngine.rule",
            { dept: "Sales", action: "Confirm order", mode: "flowEngine.mode.ask" },
            "en",
        )
    })

    it.each([
        ["en", { vi: "Xac nhan don" }, "saved_order"],
        ["en", { vi: "Xac nhan don", en: null }, "saved_order"],
        ["vi", { en: "Confirm order" }, "saved_order"],
        ["vi", { vi: null, en: "Confirm order" }, "saved_order"],
        ["en", { vi: "Xac nhan don", en: "" }, ""],
        ["vi", { vi: "", en: "Confirm order" }, ""],
    ] as const)("preserves the %s database label result for %s", async (locale, label, expected) => {
        const { service, parseAuthorityChat, saveRule, catalog, actionCatalog } = await build()
        actionCatalog.list.mockResolvedValue([Object.assign(actionOf(), { label })])
        parseAuthorityChat.mockResolvedValue({ ...NOTHING, rules: [{ action: "confirm_order", mode: "never" }] })
        saveRule.mockResolvedValue(ruleOf({ action: "saved_order", mode: "never", limit_vnd: null }))

        await expect(service.apply(member, "order", locale)).resolves.toEqual({
            summary: "flowEngine.authoritySaved",
            authority: null,
            rules: [ruleOf()],
        })

        expect(catalog.get).toHaveBeenCalledWith(
            "flowEngine.rule",
            { dept: "Sales", action: expected, mode: "flowEngine.mode.never" },
            locale,
        )
    })
}

const registerRuleTranslations = () => {
    it("formats the saved action key when a rule line has no plan", async () => {
        const { service, catalog } = await build()

        await expect(service["ruleLine"](ruleOf(), undefined, "en")).resolves.toBe("flowEngine.rule")

        expect(catalog.get).toHaveBeenCalledWith(
            "flowEngine.rule",
            { dept: "Sales", action: "confirm_order", mode: "flowEngine.mode.ask" },
            "en",
        )
    })

    it("uses the stated amount for an explicit rule and retains required fields in the audit", async () => {
        const { service, parseAuthorityChat, rules, saveRule, decide, catalog } = await build()
        const before = ruleOf({ mode: "auto", limit_vnd: 1000, required_fields: ["address"] })
        const after = ruleOf({ mode: "auto", limit_vnd: 5000, required_fields: ["address"] })
        rules.list.mockResolvedValue([before])
        saveRule.mockResolvedValue(after)
        parseAuthorityChat.mockResolvedValue({ ...NOTHING, rules: [{ action: "confirm_order", mode: "auto" }] })

        await expect(service.apply(member, "order under 5k", "en")).resolves.toMatchObject({
            summary: "flowEngine.authoritySaved",
        })

        expect(saveRule).toHaveBeenCalledWith("ws-1", {
            action: "confirm_order",
            department: "sales",
            mode: "auto",
            limit_vnd: 5000,
            required_fields: ["address"],
            note: null,
        })
        expect(decide).toHaveBeenCalledWith(
            expect.anything(),
            expect.objectContaining({
                before: { summary: "confirm_order=auto", fields: { mode: "auto", limit_vnd: 1000 } },
                after: { summary: "confirm_order=auto", fields: { mode: "auto", limit_vnd: 5000 } },
            }),
        )
        expect(catalog.get).toHaveBeenCalledWith("flowEngine.ruleLimit", { amount: "\u20ab5,000" }, "en")
    })

    it("keeps a stored limit for a mode change and omits the amount suffix for non-auto rules", async () => {
        const { service, parseAuthorityChat, rules, saveRule, catalog } = await build()
        rules.list.mockResolvedValue([ruleOf({ mode: "auto", limit_vnd: 8000 })])
        saveRule.mockResolvedValue(ruleOf({ mode: "never", limit_vnd: 8000 }))
        parseAuthorityChat.mockResolvedValue({ ...NOTHING, rules: [{ action: "confirm_order", mode: "never" }] })

        await expect(service.apply(member, "order", "vi")).resolves.toMatchObject({
            summary: "flowEngine.authoritySaved",
        })

        expect(saveRule).toHaveBeenCalledWith("ws-1", expect.objectContaining({ mode: "never", limit_vnd: 8000 }))
        expect(catalog.get).not.toHaveBeenCalledWith("flowEngine.ruleLimit", expect.anything(), expect.anything())
    })

    it("prefers and rounds an explicit model limit while retaining the stored mode", async () => {
        const { service, parseAuthorityChat, rules, saveRule } = await build()
        rules.list.mockResolvedValue([ruleOf({ mode: "ask", limit_vnd: 1000 })])
        saveRule.mockResolvedValue(ruleOf({ mode: "ask", limit_vnd: 7 }))
        parseAuthorityChat.mockResolvedValue({ ...NOTHING, rules: [{ action: "confirm_order", limit_vnd: 7.4 }] })

        await expect(service.apply(member, "order under 5k", "en")).resolves.toMatchObject({
            summary: "flowEngine.authoritySaved",
        })

        expect(saveRule).toHaveBeenCalledWith("ws-1", expect.objectContaining({ mode: "ask", limit_vnd: 7 }))
    })
}

const registerThresholdGuards = () => {
    it("does not give an unrelated amount to an action without an amount limit", async () => {
        const { service, parseAuthorityChat, saveRule } = await build([
            actionOf({ action: "send_quote", amount_limit: false }),
        ])
        parseAuthorityChat.mockResolvedValue({ ...NOTHING, rules: [{ action: "send_quote", mode: "never" }] })
        saveRule.mockResolvedValue(ruleOf({ action: "send_quote", mode: "never", limit_vnd: null }))

        await expect(service.apply(member, "quote under 5k", "vi")).resolves.toMatchObject({
            summary: "flowEngine.authoritySaved",
        })

        expect(saveRule).toHaveBeenCalledWith(
            "ws-1",
            expect.objectContaining({ action: "send_quote", mode: "never", limit_vnd: null }),
        )
    })

    it("lets the final duplicate rule cancel an earlier planned change", async () => {
        const { service, parseAuthorityChat, saveRule } = await build()
        parseAuthorityChat.mockResolvedValue({
            ...NOTHING,
            rules: [
                { action: "confirm_order", mode: "never", limit_vnd: 5 },
                { action: "confirm_order", mode: "ask" },
            ],
        })

        await expect(service.apply(member, "order", "vi")).resolves.toMatchObject({
            summary: "flowEngine.authorityNothing",
        })
        expect(saveRule).not.toHaveBeenCalled()
    })

    it("rejects automatic mode for a capped action before writing any rule", async () => {
        const { service, parseAuthorityChat, saveRule, log } = await build([actionOf({ max_mode: "ask" })])
        parseAuthorityChat.mockResolvedValue({
            ...NOTHING,
            rules: [{ action: "confirm_order", mode: "auto", limit_vnd: 10 }],
        })

        await expect(service.apply(member, "order", "vi")).rejects.toMatchObject({
            code: FlowEngineErrorCode.ModeCapped,
            params: { action: "confirm_order" },
        })
        expect(saveRule).not.toHaveBeenCalled()
        expect(log).not.toHaveBeenCalled()
    })
}

const member = builder<WorkspaceMember>({
    userId: "user-1",
    workspaceId: "ws-1",
    role: "owner",
    staffId: null,
    displayName: "An",
    status: "active",
})()

const actionOf = builder<AuthorityActionRecord>({
    action: "confirm_order",
    module_key: "sales",
    sort_order: 0,
    default_mode: "ask",
    default_limit_vnd: null,
    default_required_fields: [],
    amount_limit: true,
    max_mode: null,
    label: { vi: "Xac nhan don", en: "Confirm order" },
})

const ruleOf = builder<AuthorityRuleRecord>({
    id: "rule-1",
    workspace_id: "ws-1",
    department: "sales",
    action: "confirm_order",
    mode: "ask",
    limit_vnd: null,
    required_fields: [],
    note: "",
    updated_at: "2026-10-12T10:00:00.000Z",
})

type Change = Awaited<ReturnType<DeepseekClient["parseAuthorityChat"]>>

const NOTHING: Change = {
    goals: {},
    policies_add: [],
    reply_style: null,
    brand_voice: null,
    limits_note_add: null,
    rules: [],
    understood: true,
}

const profileOf = builder<AuthorityProfile>({
    policies: " Old policy ",
    reply_style: "brief",
    brand_voice: "warm",
    limits_note: " Old limit ",
    goal_revenue_vnd: null,
    goal_new_customers: null,
    goal_first_reply_minutes: null,
    goal_note: "",
    updated_by: "An",
    updated_at: "2026-10-12T10:00:00.000Z",
})

const build = async (actions: ReadonlyArray<AuthorityActionRecord> = [actionOf()]) => {
    const parseAuthorityChat = jest.fn().mockResolvedValue(NOTHING)
    const saveRule = jest.fn().mockResolvedValue(ruleOf({ mode: "auto", limit_vnd: 20_000_000 }))
    const saveSheet = jest.fn()
    const decide = jest.fn().mockResolvedValue(undefined)
    const log = jest.fn().mockResolvedValue(undefined)
    const entityManager = mockEntityManager()
    const catalog = mock<MessageCatalog>({ get: jest.fn((key: string) => key) })
    const authority = mock<AuthorityService>({ profileOf: jest.fn().mockResolvedValue(null), save: saveSheet })
    const rules = mock<AuthorityRulesService>({
        list: jest.fn().mockResolvedValue([ruleOf()]),
        save: saveRule,
    })
    const actionCatalog = mock<AuthorityActionsService>({ list: jest.fn().mockResolvedValue(actions) })
    const modules = mock<ModuleCatalogService>({ nameOf: jest.fn().mockResolvedValue("Sales") })
    const evidence = mock<EvidenceService>({ decide, log })
    const ai = mock<DeepseekClient>({ parseAuthorityChat })
    const moduleRef = await Test.createTestingModule({
        providers: [
            AuthorityChatService,
            { provide: PRIMARY_ENTITY_MANAGER, useValue: entityManager },
            { provide: MESSAGE_CATALOG, useValue: catalog },
            { provide: AuthorityService, useValue: authority },
            { provide: AuthorityRulesService, useValue: rules },
            { provide: AuthorityActionsService, useValue: actionCatalog },
            { provide: ModuleCatalogService, useValue: modules },
            { provide: EvidenceService, useValue: evidence },
            { provide: DEEPSEEK_CLIENT, useValue: ai },
        ],
    }).compile()
    return {
        service: moduleRef.get(AuthorityChatService),
        parseAuthorityChat,
        saveRule,
        saveSheet,
        decide,
        log,
        authority,
        rules,
        catalog,
        modules,
        actionCatalog,
        entityManager,
    }
}

describe("AuthorityChatService", () => {
    registerRuleCards()
    registerAuthorityEdits()
    registerGoalNotes()
    registerRuleSaving()
    registerRuleTranslations()
    registerThresholdGuards()
})
