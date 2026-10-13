import { Injectable } from "@nestjs/common"
import type { EntityManager } from "typeorm"
import { InjectPrimaryEntityManager } from "@modules/platform/database"
import type { WizardDraft } from "./zalo-wizard-drafts.contracts"
import type { WizardDraftRow } from "./persistence/zalo-wizard-drafts.rows"
import { DROP_WIZARD_DRAFT, FIND_WIZARD_DRAFT } from "./persistence/zalo-wizard-drafts.sql"

const ABSENT: WizardDraft = { present: false, appId: "", appSecret: "", oaSecret: "" }

@Injectable()
/** The keys the Zalo wizard handed over for a connection while the back end seals them; the only reader and remover of zalo_wizard_drafts. */
export class ZaloWizardDraftsService {
    constructor(@InjectPrimaryEntityManager() private readonly entityManager: EntityManager) {}

    /** The keys waiting for a connection; `present` is false when there are none (sealed already, or never written). */
    async draftOf(connectionId: string): Promise<WizardDraft> {
        const row = (await this.entityManager.query<Array<WizardDraftRow>>(FIND_WIZARD_DRAFT, [connectionId]))[0]
        if (row === undefined) return ABSENT
        return {
            present: true,
            appId: row.app_id ?? "",
            appSecret: row.app_secret ?? "",
            oaSecret: row.oa_secret ?? "",
        }
    }

    /** Removes the draft of a connection once its keys are sealed. */
    async dropDraft(connectionId: string): Promise<void> {
        await this.entityManager.query(DROP_WIZARD_DRAFT, [connectionId])
    }
}
