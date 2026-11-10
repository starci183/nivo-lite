import {
    CALL_WORKFLOW_STEP,
    DEFAULT_ENTRY,
    LATEST_VERSION,
    TRIGGER_SOURCES,
    suppliedParamsOf,
} from "@nivo-lite/agent-sdk/graph"
import type {
    ContractProblem,
    ContractType,
    EntryOpenTo,
    GraphSpec,
    GraphSpecNode,
    TriggerCondition,
    TriggerSourceKind,
} from "@nivo-lite/agent-sdk/graph"
import { OUTCOME_STEP } from "@nivo-lite/agent-sdk/node"
import type { NodeLocale } from "../nodes/node-schema.types"

/*
 * The contract parts of a workflow (its inputs, triggers, outcomes, entry rule, end hand-offs and every param binding) as the editor,
 * the graph canvas and the agent Graph page draw them, in words. One place for the words, read by the back end and the web alike.
 */

type Words = Readonly<Record<NodeLocale, string>>

/** The words of each trigger source kind. */
export const TRIGGER_SOURCE_LABELS: Readonly<Record<TriggerSourceKind, Words>> = {
    zalo: { vi: "Zalo", en: "Zalo" },
    telegram: { vi: "Telegram", en: "Telegram" },
    website: { vi: "Trang web", en: "Website" },
    sepay: { vi: "SePay", en: "SePay" },
    timer: { vi: "Hẹn giờ chăm sóc", en: "Care timer" },
    schedule: { vi: "Lịch", en: "Schedule" },
    "chats-group": { vi: "Nhóm chat", en: "Group chat" },
    workflow: { vi: "Được quy trình khác gọi", en: "Called by another workflow" },
}

/** The words of each entry rule. */
export const ENTRY_LABELS: Readonly<Record<EntryOpenTo, Words>> = {
    any: { vi: "Mọi quy trình được gọi", en: "Any workflow may call" },
    agent: { vi: "Chỉ quy trình của agent này", en: "Only this agent's workflows" },
}

/** The words of each contract type. */
export const CONTRACT_TYPE_LABELS: Readonly<Record<ContractType, Words>> = {
    string: { vi: "chữ", en: "text" },
    number: { vi: "số", en: "number" },
    integer: { vi: "số nguyên", en: "whole number" },
    boolean: { vi: "có/không", en: "yes/no" },
    object: { vi: "đối tượng", en: "object" },
    array: { vi: "danh sách", en: "list" },
}

/** The words of each agent a hand-off may call, by module key. */
export const AGENT_LABELS: Readonly<Record<string, Words>> = {
    sales: { vi: "Bán hàng", en: "Sales" },
    accounting: { vi: "Kế toán", en: "Accounting" },
    chatbot: { vi: "Chatbot", en: "Chatbot" },
}

/** The words of the params the seeded workflows name; a param without words shows its name. */
export const PARAM_LABELS: Readonly<Record<string, Words>> = {
    leadId: { vi: "Khách", en: "Customer" },
    conversationId: { vi: "Cuộc trò chuyện", en: "Conversation" },
    text: { vi: "Lời khách", en: "Customer's words" },
    channel: { vi: "Kênh", en: "Channel" },
    messages: { vi: "Tin nhắn", en: "Messages" },
    messageIds: { vi: "Mã tin nhắn", en: "Message ids" },
    items: { vi: "Sản phẩm", en: "Items" },
    address: { vi: "Địa chỉ", en: "Address" },
    occasion: { vi: "Dịp", en: "Occasion" },
    orderId: { vi: "Đơn hàng", en: "Order" },
    claimId: { vi: "Báo đã chuyển", en: "Payment claim" },
    transactionId: { vi: "Giao dịch", en: "Transaction" },
    slotMs: { vi: "Giờ báo cáo", en: "Report time" },
    careKind: { vi: "Loại chăm sóc", en: "Care kind" },
    ref: { vi: "Đối tượng", en: "Subject" },
    suffix: { vi: "Lần nhắc", en: "Reminder" },
    dueAt: { vi: "Hạn", en: "Due" },
    request: { vi: "Yêu cầu", en: "Request" },
    contact: { vi: "Liên hệ", en: "Contact" },
    summary: { vi: "Tóm tắt", en: "Summary" },
    reason: { vi: "Lý do", en: "Reason" },
    lastAskedAt: { vi: "Lần hỏi cuối", en: "Last asked" },
    actorMemberId: { vi: "Người gửi", en: "Sender" },
    deliveryAt: { vi: "Giờ giao", en: "Delivery time" },
    name: { vi: "Tên khách", en: "Customer name" },
    phone: { vi: "Số điện thoại", en: "Phone" },
    email: { vi: "Email", en: "Email" },
    recipientName: { vi: "Tên người nhận", en: "Recipient name" },
    recipientPhone: { vi: "SĐT người nhận", en: "Recipient phone" },
    lastOrderId: { vi: "Đơn gần nhất", en: "Latest order" },
    lastOrderCode: { vi: "Mã đơn gần nhất", en: "Latest order code" },
    lastPaymentId: { vi: "Khoản trả gần nhất", en: "Latest payment" },
    facts: { vi: "Thông tin đã biết", en: "Known facts" },
    images: { vi: "Ảnh", en: "Pictures" },
    missing: { vi: "Phần còn thiếu", en: "What is missing" },
    reply: { vi: "Câu trả lời", en: "Reply" },
    stage: { vi: "Giai đoạn", en: "Stage" },
    branch: { vi: "Nhánh", en: "Branch" },
    amountVnd: { vi: "Số tiền", en: "Amount" },
    intents: { vi: "Ý định", en: "Intents" },
    lines: { vi: "Các dòng", en: "Lines" },
    grounded: { vi: "Có căn cứ", en: "Grounded" },
    draft: { vi: "Bản nháp", en: "Draft" },
    result: { vi: "Kết quả", en: "Result" },
    status: { vi: "Trạng thái", en: "Status" },
    tag: { vi: "Thẻ", en: "Tag" },
    values: { vi: "Giá trị", en: "Values" },
    outcome: { vi: "Kết quả", en: "Outcome" },
    order: { vi: "Đơn hàng", en: "Order" },
    complaint: { vi: "Khiếu nại", en: "Complaint" },
    paymentClaim: { vi: "Báo đã chuyển", en: "Payment claim" },
    payerName: { vi: "Tên người chuyển", en: "Payer name" },
    claim: { vi: "Báo chuyển khoản", en: "Claim" },
    attachment: { vi: "Tệp đính kèm", en: "Attachment" },
    count: { vi: "Số lượng", en: "Count" },
    issue: { vi: "Vấn đề", en: "Issue" },
    orderNumber: { vi: "Mã đơn", en: "Order number" },
    content: { vi: "Nội dung chuyển khoản", en: "Transfer content" },
    qrUrl: { vi: "Mã QR", en: "QR code" },
    arrival: { vi: "Khoản tiền về", en: "Arrival" },
    evidenced: { vi: "Bằng chứng", en: "Evidence" },
    candidateIds: { vi: "Đơn ứng viên", en: "Candidate orders" },
    reasons: { vi: "Lý do", en: "Reasons" },
    sent: { vi: "Đã gửi", en: "Sent" },
    posted: { vi: "Đã báo", en: "Posted" },
    id: { vi: "Mã", en: "Id" },
    kind: { vi: "Loại", en: "Kind" },
    existingOrderId: { vi: "Đơn đang soạn", en: "Draft order" },
    note: { vi: "Ghi chú", en: "Note" },
    question: { vi: "Câu hỏi", en: "Question" },
    thread: { vi: "Đoạn chat", en: "Thread" },
    history: { vi: "Lịch sử chat", en: "Chat history" },
    body: { vi: "Lời khách", en: "Customer's words" },
    payload: { vi: "Nội dung việc", en: "Work item content" },
    claimKind: { vi: "Loại báo chuyển", en: "Claim kind" },
}

/** The words of a param, its name when it has none; a dotted path is worded member by member (`paymentClaim.amountVnd`). */
export const paramLabelOf = (name: string, locale: NodeLocale): string =>
    PARAM_LABELS[name]?.[locale] ??
    name
        .split(".")
        .map((part) => PARAM_LABELS[part]?.[locale] ?? part)
        .join(" · ")

const CONDITION_WORDS: Readonly<Record<TriggerCondition["op"], Words>> = {
    equals: { vi: "là", en: "is" },
    "not-equals": { vi: "khác", en: "is not" },
    contains: { vi: "có chứa", en: "contains" },
    present: { vi: "có giá trị", en: "is set" },
}

/** One param a trigger supplies, as a chip. */
export interface ParamChipView {
    readonly name: string
    readonly label: string
    readonly type: ContractType
    readonly typeLabel: string
}

/** One trigger of a workflow as its card draws it. */
export interface TriggerView {
    readonly key: string
    readonly sourceKind: TriggerSourceKind
    readonly sourceLabel: string
    readonly connectionId: string | null
    /** Whether the source kind listens on a connection (so the editor offers the account select). */
    readonly hasConnection: boolean
    readonly conditions: ReadonlyArray<{ readonly label: string }>
    readonly params: ReadonlyArray<ParamChipView>
}

/** One outcome of a workflow. */
export interface OutcomeView {
    readonly key: string
    readonly label: string
    readonly outputs: ReadonlyArray<ParamChipView>
}

/** The entry rule in words. */
export interface EntryView {
    readonly openTo: EntryOpenTo
    readonly label: string
    /** Whether the workflow keeps the customer's conversation while it is open. */
    readonly holdsConversation: boolean
}

/**
 * One param binding as a chip or a plain value: a ref is dynamic, written `= steps.order.output.id` and drawn as a pink chip; anything
 * else is fixed and drawn plain.
 */
export interface BindingView {
    readonly name: string
    readonly label: string
    readonly kind: "ref" | "fixed"
    /** `= <ref>` for a ref, the value written out for a fixed one. */
    readonly text: string
    /** The ref without the `=`, for a ref; null for a fixed value. */
    readonly ref: string | null
    /** The default of a ref, written out; null when it has none or the binding is fixed. */
    readonly fallback: string | null
}

/** An end hand-off as its card draws it: the exact target and the param table. */
export interface CallView {
    readonly agent: string
    readonly agentLabel: string
    readonly workflow: string
    /** The target's name when known (the reader passes the names of the workspace's workflows), else the key. */
    readonly workflowLabel: string
    /** `latest` or the pinned number, as text. */
    readonly version: string
    readonly versionLabel: string
    readonly params: ReadonlyArray<BindingView>
}

/** An outcome end as its card draws it. */
export interface OutcomeEndView {
    readonly key: string
    readonly label: string
    readonly bindings: ReadonlyArray<BindingView>
}

/** One hand-off of a workflow, for the agent Graph page: which outcome it follows and the target it calls. */
export interface CallEdgeView {
    readonly nodeKey: string
    readonly outcome: string | null
    readonly agent: string
    readonly workflow: string
    readonly version: string
}

const isRecord = (value: unknown): value is Readonly<Record<string, unknown>> =>
    typeof value === "object" && value !== null && !Array.isArray(value)

const refOf = (binding: unknown): { readonly $ref: string; readonly default?: unknown } | null =>
    isRecord(binding) && typeof binding.$ref === "string" ? { $ref: binding.$ref, default: binding.default } : null

/** A fixed value written out for the owner: words as they are, anything else as JSON. */
const written = (value: unknown): string => (typeof value === "string" ? value : JSON.stringify(value ?? null))

/** One binding as a chip (a ref) or a plain value. */
export const bindingViewOf = (name: string, binding: unknown, locale: NodeLocale = "vi"): BindingView => {
    const ref = refOf(binding)
    const label = paramLabelOf(name, locale)
    if (ref === null) return { name, label, kind: "fixed", text: written(binding), ref: null, fallback: null }
    return {
        name,
        label,
        kind: "ref",
        text: `= ${ref.$ref}`,
        ref: ref.$ref,
        fallback: ref.default === undefined ? null : written(ref.default),
    }
}

/** Every binding of a record, in its order. */
export const bindingViewsOf = (bindings: unknown, locale: NodeLocale = "vi"): ReadonlyArray<BindingView> =>
    isRecord(bindings) ? Object.entries(bindings).map(([name, binding]) => bindingViewOf(name, binding, locale)) : []

const chipOf = (name: string, type: ContractType, locale: NodeLocale): ParamChipView => ({
    name,
    label: paramLabelOf(name, locale),
    type,
    typeLabel: CONTRACT_TYPE_LABELS[type][locale],
})

/** The words of one trigger condition: `careKind có chứa "payment"`. */
const conditionLabelOf = (condition: TriggerCondition, locale: NodeLocale): string => {
    const words = CONDITION_WORDS[condition.op][locale]
    const param = paramLabelOf(condition.param, locale)
    return condition.op === "present" ? `${param} ${words}` : `${param} ${words} ${written(condition.value)}`
}

/** The triggers of a workflow; empty for a graph from before contracts. */
export const triggerViewsOf = (spec: GraphSpec, locale: NodeLocale): ReadonlyArray<TriggerView> =>
    (spec.triggers ?? []).map((trigger) => ({
        key: trigger.key,
        sourceKind: trigger.source.kind,
        sourceLabel: TRIGGER_SOURCE_LABELS[trigger.source.kind][locale],
        connectionId: trigger.source.connectionId,
        hasConnection: TRIGGER_SOURCES[trigger.source.kind].connectionKind !== null,
        conditions: (trigger.conditions ?? []).map((condition) => ({ label: conditionLabelOf(condition, locale) })),
        params: suppliedParamsOf(trigger.source, spec.contract)
            .filter(
                (param) =>
                    spec.contract === undefined || spec.contract.inputs.some((one) => one.name === param.name),
            )
            .map((param) => chipOf(param.name, param.type, locale)),
    }))

/** The outcomes of a workflow. */
export const outcomeViewsOf = (spec: GraphSpec, locale: NodeLocale): ReadonlyArray<OutcomeView> =>
    (spec.outcomes ?? []).map((outcome) => ({
        key: outcome.key,
        label: outcome.label,
        outputs: outcome.outputs.map((output) => chipOf(output.name, output.type, locale)),
    }))

/** The entry rule of a workflow, open to any caller when it names none. */
export const entryViewOf = (spec: GraphSpec, locale: NodeLocale): EntryView => {
    const entry = spec.entry ?? DEFAULT_ENTRY
    return { openTo: entry.openTo, label: ENTRY_LABELS[entry.openTo][locale], holdsConversation: entry.holdsConversation === true }
}

/** The version a hand-off calls, as text. */
const versionTextOf = (version: unknown): string => (typeof version === "number" ? String(version) : LATEST_VERSION)

/** The hand-off of an end node, or null for any other node. `names` gives the target workflows' names by `<agent>.<workflow>`. */
export const callViewOf = (
    node: GraphSpecNode,
    locale: NodeLocale,
    names: Readonly<Record<string, string>> = {},
): CallView | null => {
    if (node.step !== CALL_WORKFLOW_STEP || !isRecord(node.params)) return null
    const agent = typeof node.params.agent === "string" ? node.params.agent : ""
    const workflow = typeof node.params.workflow === "string" ? node.params.workflow : ""
    const version = versionTextOf(node.params.version)
    return {
        agent,
        agentLabel: AGENT_LABELS[agent]?.[locale] ?? agent,
        workflow,
        workflowLabel: names[`${agent}.${workflow}`] ?? workflow,
        version,
        versionLabel:
            version === LATEST_VERSION
                ? locale === "vi"
                    ? "Bản mới nhất"
                    : "Latest version"
                : locale === "vi"
                  ? `Bản ${version}`
                  : `Version ${version}`,
        params: bindingViewsOf(node.params.inputs, locale),
    }
}

/** The outcome an end node reaches, or null for any other node. */
export const outcomeEndViewOf = (node: GraphSpecNode, spec: GraphSpec, locale: NodeLocale): OutcomeEndView | null => {
    if (node.step !== OUTCOME_STEP || !isRecord(node.params)) return null
    const key = typeof node.params.outcome === "string" ? node.params.outcome : ""
    return {
        key,
        label: spec.outcomes?.find((outcome) => outcome.key === key)?.label ?? key,
        bindings: bindingViewsOf(node.params.outputs, locale),
    }
}

/**
 * Every hand-off of a workflow with the outcome it follows: the nearest outcome end before it, through other hand-offs (an outcome may
 * fan out to several calls); null when it follows none.
 */
export const callEdgesOf = (spec: GraphSpec): ReadonlyArray<CallEdgeView> => {
    const byKey = new Map(spec.nodes.map((node) => [node.key, node]))
    const before = new Map<string, string>()
    for (const node of spec.nodes) {
        const targets = [...(node.next === undefined ? [] : [node.next]), ...Object.values(node.routes ?? {})]
        for (const target of targets) if (!before.has(target)) before.set(target, node.key)
    }
    const outcomeBefore = (key: string): string | null => {
        const seen = new Set<string>()
        for (let at = before.get(key); at !== undefined && !seen.has(at); at = before.get(at)) {
            seen.add(at)
            const node = byKey.get(at)
            if (node === undefined) return null
            if (node.step === OUTCOME_STEP && isRecord(node.params) && typeof node.params.outcome === "string")
                return node.params.outcome
            if (node.step !== CALL_WORKFLOW_STEP) return null
        }
        return null
    }
    return spec.nodes.flatMap((node): ReadonlyArray<CallEdgeView> => {
        if (node.step !== CALL_WORKFLOW_STEP || !isRecord(node.params)) return []
        return [
            {
                nodeKey: node.key,
                outcome: outcomeBefore(node.key),
                agent: typeof node.params.agent === "string" ? node.params.agent : "",
                workflow: typeof node.params.workflow === "string" ? node.params.workflow : "",
                version: versionTextOf(node.params.version),
            },
        ]
    })
}

/** The words of each contract problem, Vietnamese first, filled with where it is. */
const CONTRACT_WORDS: Readonly<Record<ContractProblem["code"], Words>> = {
    TRIGGER_INPUT_UNSUPPLIED: {
        vi: "Nguồn của đầu vào {where} không cung cấp tham số bắt buộc {name}.",
        en: "The source of input {where} does not supply the required param {name}.",
    },
    TRIGGER_INPUT_TYPE: {
        vi: "Nguồn của đầu vào {where} cung cấp {name} sai kiểu.",
        en: "The source of input {where} supplies {name} with the wrong type.",
    },
    TRIGGER_CONNECTION_INVALID: {
        vi: "Nguồn của đầu vào {where} không dùng tài khoản kết nối.",
        en: "The source of input {where} takes no connection.",
    },
    TRIGGER_CONDITION_UNKNOWN: {
        vi: "Điều kiện của đầu vào {where} đọc {name}, nguồn này không có.",
        en: "A condition of input {where} reads {name}, which the source does not supply.",
    },
    TRIGGER_SOURCES_MISMATCH: {
        vi: "Các nguồn đánh thức không khớp với các đầu vào của quy trình.",
        en: "The wake sources do not match the workflow's inputs.",
    },
    TRIGGER_KEY_DUPLICATE: { vi: "Hai đầu vào cùng tên {where}.", en: "Two inputs share the name {where}." },
    CONTRACT_INPUT_DUPLICATE: { vi: "Hai tham số đầu vào cùng tên {name}.", en: "Two inputs share the name {name}." },
    CALL_TARGET_UNKNOWN: {
        vi: "Bước {where} gọi một quy trình không có trong cửa hàng.",
        en: "Step {where} calls a workflow the shop does not have.",
    },
    CALL_VERSION_UNKNOWN: {
        vi: "Bước {where} ghim một phiên bản không có của quy trình được gọi.",
        en: "Step {where} pins a version the called workflow does not have.",
    },
    CALL_INPUT_MISSING: {
        vi: "Bước {where} chưa truyền tham số bắt buộc {name} của quy trình được gọi.",
        en: "Step {where} does not pass the required param {name} of the called workflow.",
    },
    CALL_INPUT_UNKNOWN: {
        vi: "Bước {where} truyền {name}, quy trình được gọi không nhận tham số này.",
        en: "Step {where} passes {name}, which the called workflow does not take.",
    },
    CALL_INPUT_TYPE: {
        vi: "Bước {where} truyền {name} sai kiểu so với quy trình được gọi.",
        en: "Step {where} passes {name} with a type the called workflow does not take.",
    },
    CALL_ENTRY_CLOSED: {
        vi: "Bước {where} gọi một quy trình chỉ mở cho chính agent của nó.",
        en: "Step {where} calls a workflow open only to its own agent.",
    },
    ENTRY_HOLD_WITHOUT_CONVERSATION: {
        vi: "Quy trình giữ cuộc trò chuyện thì phải nhận tham số bắt buộc Cuộc trò chuyện.",
        en: "A workflow that holds the conversation must require the conversation as an input.",
    },
    OUTCOME_DUPLICATE: { vi: "Hai kết quả hoặc hai trường cùng tên {where}.", en: "Two outcomes or fields share {where}." },
    OUTCOME_UNKNOWN: {
        vi: "Bước {where} kết thúc ở một kết quả quy trình không khai báo.",
        en: "Step {where} ends on an outcome the workflow does not declare.",
    },
    OUTCOME_OUTPUT_MISSING: {
        vi: "Bước {where} chưa điền trường {name} của kết quả.",
        en: "Step {where} does not fill the outcome field {name}.",
    },
    OUTCOME_OUTPUT_UNKNOWN: {
        vi: "Bước {where} điền {name}, kết quả không có trường này.",
        en: "Step {where} fills {name}, which the outcome does not have.",
    },
    OUTCOME_OUTPUT_TYPE: {
        vi: "Bước {where} điền {name} sai kiểu.",
        en: "Step {where} fills {name} with the wrong type.",
    },
}

/** The step or trigger a problem is at, and the param it names (`triggers.zalo.leadId` → zalo, leadId). */
const placeOf = (at: string): { readonly where: string; readonly name: string } => {
    const parts = at.split(".")
    if (parts[0] === "triggers") return { where: parts[1] ?? "", name: parts.slice(2).join(".") }
    if (parts[0] === "contract" || parts[0] === "outcomes") return { where: parts.slice(1).join("."), name: parts.slice(1).join(".") }
    return { where: parts[0] ?? "", name: parts.slice(1).join(".") }
}

/** One contract problem in the owner's words; the step key is replaced by `titles[key]` when the reader passes step titles. */
export const contractProblemText = (
    problem: ContractProblem,
    locale: NodeLocale,
    titles: Readonly<Record<string, string>> = {},
): string => {
    const { where, name } = placeOf(problem.at)
    return CONTRACT_WORDS[problem.code][locale]
        .replace("{where}", titles[where] ?? where)
        .replace("{name}", name === "" ? "" : paramLabelOf(name, locale))
}
