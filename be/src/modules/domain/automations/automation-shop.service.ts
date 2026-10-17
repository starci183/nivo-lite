import { Injectable } from "@nestjs/common"
import type { EntityManager } from "typeorm"
import type { LocalizedText } from "@modules/domain/automation-templates"
import { InjectPrimaryEntityManager } from "@modules/platform/database"
import { InjectMessageCatalog } from "@modules/platform/i18n"
import type { MessageCatalog } from "@modules/platform/i18n"
import type { OverviewRows, PreviewSample, ShopWithHours, TextParams } from "./automations.contracts"
import { SELECT_OVERVIEW } from "./persistence/automations.sql"
import type { RequirementLabeller } from "./policies/cards.policy"
import { contextVersionFor, contextsFrom } from "./policies/context.policy"
import type { ActiveContexts, ShopPatterns } from "./policies/context.policy"
import { shopContextFrom } from "./policies/context.policy"
import { NEUTRAL_VARIABLES, SAMPLE_VARIABLES } from "./words.contracts"

/** The text a model is given about the shop and the context version a wording is written from. */
export interface ShopContextText {
    /** All of the active context text. */
    readonly text: string
    /** The version the wording of a template is written from. */
    readonly version: number | null
}

@Injectable()
/** The shop an automation speaks for: its rows, its opening hours and tone, the language data that reads them and the words of the screen. */
export class AutomationShopService {
    private patterns: ShopPatterns | undefined

    constructor(
        @InjectPrimaryEntityManager() private readonly entityManager: EntityManager,
        @InjectMessageCatalog() private readonly catalog: MessageCatalog,
    ) {}

    /** Every row the automations screen reads, in one call. */
    async overviewRows(workspaceId: string): Promise<OverviewRows> {
        const [row] = await this.entityManager.query<Array<{ data: OverviewRows }>>(SELECT_OVERVIEW, [workspaceId])
        return row?.data ?? EMPTY_ROWS
    }

    /** The language data that reads a shop, compiled once from the message catalog. */
    shopPatterns(): ShopPatterns {
        this.patterns ??= {
            capabilities: {
                has_deposits: this.pattern("has_deposits"),
                has_appointments: this.pattern("has_appointments"),
                sells_online: this.pattern("sells_online"),
                has_recurring_contracts: this.pattern("has_recurring_contracts"),
                has_delivery: this.pattern("has_delivery"),
            },
            due: this.pattern("due"),
            hoursLine: this.pattern("hoursLine"),
            negation: this.pattern("negation"),
        }
        return this.patterns
    }

    /** The active contexts of the rows. */
    contextsOf(rows: OverviewRows): ActiveContexts {
        return contextsFrom(rows.installations)
    }

    /** The shop of a workspace: its name, its opening hours and its tone. */
    async shopOf(workspaceId: string): Promise<ShopWithHours> {
        const rows = await this.overviewRows(workspaceId)
        return this.shopFrom(rows)
    }

    /** The shop of rows already read. */
    shopFrom(rows: OverviewRows): ShopWithHours {
        return shopContextFrom(rows.workspace_name, rows.authority, this.contextsOf(rows), this.shopPatterns())
    }

    /** The active context of the workspace as one text, and the version a template of `moduleKey` (null: the workspace) is written from. */
    async contextFor(workspaceId: string, moduleKey: string | null): Promise<ShopContextText> {
        const contexts = this.contextsOf(await this.overviewRows(workspaceId))
        return { text: contexts.text, version: contextVersionFor(moduleKey, contexts.versions) }
    }

    /** The label of one missing requirement, in both languages. */
    labeller(): RequirementLabeller {
        return (kind, key) =>
            kind === "module"
                ? {
                      vi: this.catalog.get("automations.missing.module", { name: this.moduleName(key, "vi") }, "vi"),
                      en: this.catalog.get("automations.missing.module", { name: this.moduleName(key, "en") }, "en"),
                  }
                : this.localized(`automations.missing.${kind}.${key}`)
    }

    /** The sample values and neutral words of a message preview. */
    sample(): PreviewSample {
        const words = (prefix: string, names: ReadonlyArray<string>): Record<string, string> =>
            Object.fromEntries(names.map((name) => [name, this.catalog.get(`automations.${prefix}.${name}`, {}, "vi")]))
        return { variables: words("sample", SAMPLE_VARIABLES), neutral: words("neutral", NEUTRAL_VARIABLES) }
    }

    /** A text in both languages. */
    localized(key: string, params: TextParams = {}): LocalizedText {
        return { vi: this.catalog.get(key, params, "vi"), en: this.catalog.get(key, params, "en") }
    }

    /** The name of a module in a language; a module the catalog does not know goes by its key. */
    private moduleName(key: string, locale: "vi" | "en"): string {
        const id = `automations.moduleName.${key}`
        const name = this.catalog.get(id, {}, locale)
        return name === id ? key : name
    }

    private pattern(name: string): RegExp {
        return new RegExp(this.catalog.get(`automations.pattern.${name}`, {}, "vi"), "i")
    }
}

const EMPTY_ROWS: OverviewRows = {
    installations: [],
    pipelines: [],
    runs: [],
    google: null,
    knowledge: [],
    due_invoices: 0,
    connections: [],
    chat_agents: 0,
    workspace_name: null,
    authority: null,
    rules: [],
    contracts: 0,
    shipped_orders: 0,
}
