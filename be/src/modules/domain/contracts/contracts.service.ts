import { Injectable } from "@nestjs/common"
import type { EntityManager } from "typeorm"
import { EventsService } from "@modules/domain/events"
import { InjectPrimaryEntityManager } from "@modules/platform/database"
import { InjectMessageCatalog, InjectRequestLocale } from "@modules/platform/i18n"
import type { MessageCatalog, RequestLocale } from "@modules/platform/i18n"
import { checkContract } from "./contract.policy"
import type { ContractResult, SaveContractParams } from "./contracts.contracts"
import { ContractsError, ContractsErrorCode } from "./errors/contracts.error"
import type { ContractsRow } from "./persistence/contracts.rows"
import { INSERT_CONTRACT, UPDATE_CONTRACT } from "./persistence/contracts.sql"

type SavedContract = Pick<
    ContractsRow,
    "id" | "lead_id" | "customer_name" | "plan" | "starts_on" | "ends_on" | "amount_vnd" | "status" | "note"
>

@Injectable()
/** The recurring sales contracts reached only through the shared primary EntityManager. */
export class ContractsService {
    constructor(
        @InjectPrimaryEntityManager() private readonly entityManager: EntityManager,
        @InjectMessageCatalog() private readonly messages: MessageCatalog,
        @InjectRequestLocale() private readonly requestLocale: RequestLocale,
        private readonly events: EventsService,
    ) {}

    /**
     * Adds or edits a recurring contract (the renewal automation reads these). The contract is judged first; a linked lead
     * must belong to the workspace (a lead of another workspace answers no row); an edit changes only the workspace own row. The write and its evidence line share one transaction.
     */
    saveContract(params: SaveContractParams): Promise<ContractResult> {
        return this.entityManager.transaction(async (tx) => {
            const verdict = checkContract(params)
            if (verdict.kind === "refused") throw new ContractsError({ code: verdict.code, params: verdict.params })
            const contract = verdict.value
            const fields = [
                params.leadId,
                contract.customerName,
                contract.plan,
                contract.startsOn,
                contract.endsOn,
                contract.amountVnd,
                contract.status,
                contract.note,
            ]
            const [row] = await (params.contractId === null
                ? tx.query<Array<SavedContract>>(INSERT_CONTRACT, [params.workspaceId, ...fields])
                : tx.query<Array<SavedContract>>(UPDATE_CONTRACT, [params.workspaceId, params.contractId, ...fields]))
            if (row === undefined) {
                throw new ContractsError(
                    params.contractId === null
                        ? { code: ContractsErrorCode.LeadNotFound, params: { id: String(params.leadId) } }
                        : { code: ContractsErrorCode.NotFound, params: { id: params.contractId } },
                )
            }
            const created = params.contractId === null
            await this.events.record(
                {
                    workspaceId: params.workspaceId,
                    leadId: params.leadId,
                    kind: created ? "contract.created" : "contract.updated",
                    actor: params.actor.displayName,
                    summary: this.messages.get(
                        created ? "contracts.created" : "contracts.updated",
                        { who: params.actor.displayName, customer: contract.customerName },
                        this.requestLocale.of(params.acceptLanguage),
                    ),
                    evidence: `${contract.startsOn} → ${contract.endsOn}`,
                },
                tx,
            )
            return {
                id: row.id,
                leadId: row.lead_id,
                customerName: row.customer_name,
                plan: row.plan,
                startsOn: row.starts_on,
                endsOn: row.ends_on,
                amountVnd: row.amount_vnd,
                status: row.status,
                note: row.note,
            }
        })
    }
}
