import { In, type EntityManager } from "typeorm"
import { entityEngineEntities } from "@modules/domain/entity-engine"
import { eachInOrder } from "@modules/platform/primitives"
import { workspaceMembersEntities } from "@modules/domain/workspace-members"
import { workspacesEntities } from "@modules/domain/workspaces"
import { linkRecords, type RecordData } from "./entity-engine-writes.builder"

const [RecordEntity] = entityEngineEntities
const [WorkspaceEntity] = workspacesEntities
const [WorkspaceMemberEntity] = workspaceMembersEntities

/** The ids of the scene: two workspaces, who sits in the first, and the records of both. */
export interface SalesDoorScene {
    /** The workspace the proof acts in. */
    readonly workspaceId: string
    /** Another workspace, whose records the first must never see. */
    readonly otherWorkspaceId: string
    /** The owner of the workspace: holds every permission. */
    readonly ownerUserId: string
    /** A staff member: the workspace granted none of the sales permissions to the seat. */
    readonly staffUserId: string
    /** The owner of the other workspace. */
    readonly otherOwnerUserId: string
    /** The customers: a new one with a small draft, a qualified one with a confirmed order, one at the proposal stage with the big draft. */
    readonly leads: readonly [string, string, string]
    /** The orders: the small draft, the confirmed one, the big draft that waits for the owner. */
    readonly orders: readonly [string, string, string]
    /** The customer of the other workspace. */
    readonly otherLeadId: string
}

/** Names every id of the scene from the ids of the suite's world. */
export const salesDoorScene = (next: () => string): SalesDoorScene => ({
    workspaceId: next(),
    otherWorkspaceId: next(),
    ownerUserId: next(),
    staffUserId: next(),
    otherOwnerUserId: next(),
    leads: [next(), next(), next()],
    orders: [next(), next(), next()],
    otherLeadId: next(),
})

/** The name of the qualified customer: it carries accents, so a search without them proves the engine folds text. */
export const BINH_NAME = "Tr\u1ea7n Th\u1ecb B\u00ecnh"

const lead = (name: string, stage: string, extra: Readonly<RecordData> = {}): RecordData => ({
    contactName: name,
    channel: "zalo",
    stage,
    ...extra,
})

/** One line of a scene order: what was ordered and how many (kept at no price, as a line named without one is). */
interface SceneLine {
    readonly name: string
    readonly qty: number
}

const order = (
    orderNo: string,
    leadId: string,
    lines: ReadonlyArray<SceneLine>,
    amountVnd: number | null,
    status: string,
): RecordData => ({
    orderNo,
    leadId,
    items: { lines: lines.map((line) => ({ name: line.name, qty: line.qty, unitVnd: 0, amountVnd: 0 })) },
    itemsText: lines.map((line) => `${String(line.qty)} x ${line.name}`).join(", "),
    note: "",
    amountVnd,
    status,
})

/** Writes one record of a workspace, as the superuser the manager is. */
export const saveRecord = async (
    manager: EntityManager,
    workspaceId: string,
    entity: string,
    id: string,
    data: RecordData,
): Promise<void> => {
    await manager.save(RecordEntity, { entity, id, workspaceId, data })
}

/** Removes what the scene wrote; the records go with their workspace. */
const removeScene = async (manager: EntityManager, scene: SalesDoorScene): Promise<void> => {
    await manager.delete(WorkspaceEntity, { id: In([scene.workspaceId, scene.otherWorkspaceId]) })
    await manager.delete("auth.users", {
        id: In([scene.ownerUserId, scene.staffUserId, scene.otherOwnerUserId]),
    })
}

/**
 * Writes the scene as the world's superuser (the seed bypasses the row-level policies on purpose) and removes it when the suite
 * ends: a workspace of an owner and a staff member without grants; three customers and three orders in it; a customer in another one.
 */
export const persistSalesDoorScene = async (
    manager: EntityManager,
    scene: SalesDoorScene,
    onClose: (work: () => Promise<void>) => void,
): Promise<void> => {
    onClose(() => removeScene(manager, scene))
    await eachInOrder([scene.ownerUserId, scene.staffUserId, scene.otherOwnerUserId], (id) =>
        manager.insert("auth.users", { id }),
    )
    await manager.insert(WorkspaceEntity, { id: scene.workspaceId, ownerId: scene.ownerUserId, name: "Sales door" })
    await manager.insert(WorkspaceEntity, {
        id: scene.otherWorkspaceId,
        ownerId: scene.otherOwnerUserId,
        name: "Other",
    })
    await manager.insert(WorkspaceMemberEntity, {
        workspaceId: scene.workspaceId,
        userId: scene.staffUserId,
        role: "staff",
        displayName: "Ha Staff",
        status: "active",
    })
    const [an, binh, chau] = scene.leads
    const [small, confirmed, big] = scene.orders
    const w = scene.workspaceId
    await saveRecord(manager, w, "blocks-core.sales.lead", an, lead("Nguyen Van An", "new", { phone: "84912000701" }))
    await saveRecord(manager, w, "blocks-core.sales.lead", binh, lead(BINH_NAME, "qualified", { need: "A call back" }))
    await saveRecord(manager, w, "blocks-core.sales.lead", chau, lead("Le Minh Chau", "proposal", { need: "20 gift sets" }))
    await saveRecord(manager, w, "blocks-core.sales.order", small, order("DH-20261104-0001", an, [{ name: "tea", qty: 2 }], 120_000, "draft"))
    await saveRecord(
        manager,
        w,
        "blocks-core.sales.order",
        confirmed,
        order("DH-20261104-0002", binh, [{ name: "cake", qty: 1 }], 300_000, "confirmed"),
    )
    await saveRecord(
        manager,
        w,
        "blocks-core.sales.order",
        big,
        order("DH-20261104-0003", chau, [{ name: "gift set", qty: 10 }], 6_000_000, "draft"),
    )
    await saveRecord(manager, scene.otherWorkspaceId, "blocks-core.sales.lead", scene.otherLeadId, lead("Foreign Customer", "new"))
    const links: ReadonlyArray<readonly [string, string]> = [
        [small, an],
        [confirmed, binh],
        [big, chau],
    ]
    await eachInOrder(links, ([orderId, leadId]) =>
        linkRecords(manager, w, { entity: "blocks-core.sales.order", id: orderId }, "lead", { entity: "blocks-core.sales.lead", id: leadId }),
    )
}
