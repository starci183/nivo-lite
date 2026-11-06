import assert from "node:assert/strict"
import type { EntitiesApi } from "@nivo-lite/agent-sdk/entity/port"
import type { EntityManager } from "typeorm"
import { workspacesEntities } from "@modules/domain/workspaces"

const [WorkspaceEntity] = workspacesEntities

/** The ids of the workspace a scene is written to. */
export interface SceneWorkspace {
    /** The workspace. */
    readonly workspaceId: string
    /** Its owner. */
    readonly userId: string
}

/** The records of Dinh's order to cash: the customer, the order, the payment, the claim, an open invoice. */
export interface SceneRecords {
    /** The customer. */
    readonly leadId: string
    /** The confirmed order, 5,000,000 VND. */
    readonly orderId: string
    /** The credit that paid it, not yet matched. */
    readonly transactionId: string
    /** A second credit of the same amount, not yet matched. */
    readonly otherTransactionId: string
    /** The customer's word that they paid. */
    readonly claimId: string
    /** The invoice issued to the customer. */
    readonly invoiceId: string
}

/** The amount of the order, in VND. */
export const ORDER_AMOUNT = 5_000_000

/** Writes a user and the workspace they own as the database owner (the back end's role cannot), and removes both when the suite ends. */
export const persistWorkspace = async (
    owner: EntityManager,
    scene: SceneWorkspace,
    onClose: (work: () => Promise<void>) => void,
): Promise<void> => {
    await owner.insert("auth.users", { id: scene.userId })
    await owner.insert(WorkspaceEntity, {
        id: scene.workspaceId,
        ownerId: scene.userId,
        name: "Accounting door",
    })
    onClose(async () => {
        await owner.delete(WorkspaceEntity, { id: scene.workspaceId })
        await owner.delete("auth.users", { id: scene.userId })
    })
}

const idOf = (written: Awaited<ReturnType<EntitiesApi["insert"]>>): string => {
    assert(written.ok, "The engine accepts every record of the scene")
    return written.row.id
}

/** Writes the order to cash through the engine, as the modules would. `now` is when the money arrived. */
export const writeScene = async (entities: EntitiesApi, now: Date): Promise<SceneRecords> => {
    const at = now.toISOString()
    const leadId = idOf(await entities.insert("sales.lead", { contactName: "Nguyen Van Dinh" }))
    const orderId = idOf(
        await entities.insert(
            "sales.order",
            {
                items: "1 x Ao dai",
                leadId,
                amountVnd: ORDER_AMOUNT,
                status: "confirmed",
            },
            { lead: leadId },
        ),
    )
    const credit = { amountVnd: ORDER_AMOUNT, payer: "NGUYEN VAN DINH", occurredAt: at }
    const transactionId = idOf(await entities.insert("payment.transaction", { ...credit, reference: "NIVO8F3K2 ck" }))
    const otherTransactionId = idOf(
        await entities.insert("payment.transaction", {
            ...credit,
            reference: "NIVO8F3K2 ck lan 2",
            externalRef: "bank-2",
        }),
    )
    const claimId = idOf(
        await entities.insert(
            "payment.claim",
            {
                amountVnd: ORDER_AMOUNT,
                names: { values: ["NGUYEN VAN DINH"] },
                body: "Da chuyen khoan roi",
                dedupeKey: "claim-1",
            },
            { order: orderId },
        ),
    )
    const invoiceId = idOf(
        await entities.insert(
            "accounting.invoice",
            { amountVnd: 2_000_000, status: "issued", issuedAt: at, dueAt: at },
            { lead: leadId },
        ),
    )
    return { leadId, orderId, transactionId, otherTransactionId, claimId, invoiceId }
}
