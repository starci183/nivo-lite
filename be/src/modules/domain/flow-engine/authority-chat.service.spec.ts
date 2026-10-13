import { builder, mock, mockEntityManager } from "@starci/jest-preset"
import { Test } from "@nestjs/testing"
import { AuthorityService } from "@modules/domain/authority"
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
import { AuthorityChatService } from "./authority-chat.service"

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

const NOTHING = {
    goals: {},
    policies_add: [],
    reply_style: null,
    brand_voice: null,
    limits_note_add: null,
    rules: [],
    understood: true,
}

const build = async (actions: ReadonlyArray<AuthorityActionRecord> = [actionOf()]) => {
    const parseAuthorityChat = jest.fn().mockResolvedValue(NOTHING)
    const saveRule = jest.fn().mockResolvedValue(ruleOf({ mode: "auto", limit_vnd: 20_000_000 }))
    const saveSheet = jest.fn()
    const decide = jest.fn().mockResolvedValue(undefined)
    const log = jest.fn().mockResolvedValue(undefined)
    const moduleRef = await Test.createTestingModule({
        providers: [
            AuthorityChatService,
            { provide: PRIMARY_ENTITY_MANAGER, useValue: mockEntityManager() },
            { provide: MESSAGE_CATALOG, useValue: mock<MessageCatalog>({ get: jest.fn((key: string) => key) }) },
            {
                provide: AuthorityService,
                useValue: mock<AuthorityService>({ profileOf: jest.fn().mockResolvedValue(null), save: saveSheet }),
            },
            {
                provide: AuthorityRulesService,
                useValue: mock<AuthorityRulesService>({
                    list: jest.fn().mockResolvedValue([ruleOf()]),
                    save: saveRule,
                }),
            },
            {
                provide: AuthorityActionsService,
                useValue: mock<AuthorityActionsService>({ list: jest.fn().mockResolvedValue(actions) }),
            },
            {
                provide: ModuleCatalogService,
                useValue: mock<ModuleCatalogService>({ nameOf: jest.fn().mockResolvedValue("Sales") }),
            },
            { provide: EvidenceService, useValue: mock<EvidenceService>({ decide, log }) },
            { provide: DEEPSEEK_CLIENT, useValue: mock<DeepseekClient>({ parseAuthorityChat }) },
        ],
    }).compile()
    return { service: moduleRef.get(AuthorityChatService), parseAuthorityChat, saveRule, saveSheet, decide, log }
}

describe("AuthorityChatService", () => {
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
})
