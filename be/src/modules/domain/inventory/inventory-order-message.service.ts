import { Injectable } from "@nestjs/common"
import type { EntityManager } from "typeorm"
import { OfficeLog, ModuleTextGenerator } from "@modules/domain/module-ops"
import { InjectPrimaryEntityManager } from "@modules/platform/database"
import { InjectMessageCatalog } from "@modules/platform/i18n"
import type { MessageCatalog } from "@modules/platform/i18n"
import type { ComposedMessage, LoadedPo } from "./inventory.contracts"
import { formatDay, formatMoney, formatQty } from "./policies/number-format.policy"
import { SELECT_BRAND_VOICE } from "./persistence/inventory.sql"

/** How long the text generator may take before the plain template is used. */
const GENERATE_TIMEOUT_MS = 40_000

/** A generated message shorter than this is not trusted. */
const MIN_GENERATED_LENGTH = 20

/** The longest message kept. */
const MESSAGE_MAX = 1800

/** The longest brand voice handed to the generator. */
const VOICE_MAX = 300

interface VoiceRow {
    readonly brand_voice: string
    readonly reply_style: string
}

@Injectable()
/** The message a supplier receives for an order or a reminder: the text generator writes it in the shop's voice, a plain template covers a failure. */
export class InventoryOrderMessageService {
    constructor(
        @InjectPrimaryEntityManager() private readonly entityManager: EntityManager,
        @InjectMessageCatalog() private readonly catalog: MessageCatalog,
        private readonly office: OfficeLog,
        private readonly generator: ModuleTextGenerator,
    ) {}

    private text(key: string, params: Record<string, string | number>): string {
        return this.catalog.get(key, params, "vi")
    }

    /** Writes the order message (kind `order`) or the reminder (kind `reminder`, only what is still missing) for a loaded order. */
    async compose(workspaceId: string, po: LoadedPo, kind: "order" | "reminder"): Promise<ComposedMessage> {
        const shop = await this.office.workspaceName(workspaceId)
        const list = po.lines
            .map((line) => ({
                name: line.itemName ?? this.text("inventory.itemFallback", {}),
                qty: line.qtyOrdered - (kind === "reminder" ? line.qtyReceived : 0),
                unit: line.itemUnit ?? "",
            }))
            .filter((line) => line.qty > 0)
            .map((line) => `- ${line.name}: ${formatQty(line.qty)} ${line.unit}`)
            .join("\n")
        const supplier = po.supplier
        const who = supplier?.contactName || supplier?.name || this.text("inventory.addressFallback", {})
        const due = po.expectedAt === null ? "" : formatDay(po.expectedAt)
        const fallback =
            kind === "reminder"
                ? this.text("inventory.reminderMessage", {
                      who,
                      shop,
                      poNo: po.poNo,
                      due: due === "" ? "" : this.text("inventory.reminderDue", { date: due }),
                      list,
                  })
                : this.text("inventory.orderMessage", {
                      who,
                      shop,
                      list,
                      expected: due === "" ? "" : this.text("inventory.orderExpected", { date: due }),
                  })
        const [voiceRow] = await this.entityManager.query<Array<VoiceRow>>(SELECT_BRAND_VOICE, [workspaceId])
        const voice = [voiceRow?.brand_voice, voiceRow?.reply_style].filter(Boolean).join(" ").slice(0, VOICE_MAX)
        const facts = [
            this.text("inventory.ai.factShop", { shop }),
            this.text("inventory.ai.factSupplier", {
                name: supplier?.name ?? "",
                contact: supplier?.contactName
                    ? this.text("inventory.ai.factContact", { contact: supplier.contactName })
                    : "",
            }),
            this.text("inventory.ai.factPoNo", { poNo: po.poNo }),
            this.text("inventory.ai.factChannel", {
                channel: this.text(`inventory.channelFact.${supplier?.channel ?? "email"}`, {}),
            }),
            due === "" ? "" : this.text("inventory.ai.factDue", { date: due }),
            this.text("inventory.ai.factItems", { list }),
            kind === "order" ? this.text("inventory.ai.factTotal", { total: formatMoney(po.totalVnd) }) : "",
            voice === "" ? "" : this.text("inventory.ai.factVoice", { voice }),
        ]
            .filter(Boolean)
            .join("\n")
        const answer = await this.generator.generate({
            workspaceId,
            purpose: kind === "order" ? "inventory_po_message" : "inventory_po_reminder",
            module: "inventory",
            system: this.text("inventory.ai.system", {}),
            user: `${this.text(kind === "order" ? "inventory.ai.taskOrder" : "inventory.ai.taskReminder", {})}\n\n${facts}`,
            timeoutMs: GENERATE_TIMEOUT_MS,
        })
        const written = answer.ok ? answer.output.trim() : ""
        return written.length >= MIN_GENERATED_LENGTH
            ? { text: written.slice(0, MESSAGE_MAX), generated: true }
            : { text: fallback, generated: false }
    }
}
