// Self-check for the pure policy gate (src/lib/policy.ts). Node 22.6+ strips the TypeScript types.
// Usage: node scripts/policy-check.mjs   (exit code 1 on any failure)
import assert from "node:assert/strict";
import { DEFAULT_RULES, FLOW_NEXT, ACTION_DEPARTMENT, applyOperatingMode, evaluateGate, isOverLimit, missingFields } from "../src/lib/policy.ts";
import { isKnownPrice, pricesInKnowledge, transferDetails } from "../src/lib/knowledge.ts";
import { mentionsCode } from "../src/lib/bank.ts";

const rule = (action, patch = {}) => {
  const d = DEFAULT_RULES.find((r) => r.action === action);
  return { id: "r", workspace_id: "w", note: "", updated_at: "", ...d, ...patch };
};
const gate = (action, proposal, extra = {}) =>
  evaluateGate({ department: ACTION_DEPARTMENT[action], action, rule: rule(action), proposal: { summary: "", fields: {}, ...proposal }, ...extra });

let passed = 0;
const check = (name, fn) => {
  fn();
  passed += 1;
  console.log(`ok  ${name}`);
};

check("assist: auto rule is downgraded to ask, limit and never untouched", () => {
  const r = applyOperatingMode(rule("confirm_order"), "assist");
  assert.equal(r.mode, "ask");
  assert.equal(r.limit_vnd, 20_000_000);
  assert.equal(applyOperatingMode(rule("send_care", { mode: "never" }), "assist").mode, "never");
  assert.equal(applyOperatingMode(rule("send_quote"), "assist").mode, "ask");
});
check("autopilot or no installation: rules apply as configured", () => {
  assert.equal(applyOperatingMode(rule("confirm_order"), "autopilot").mode, "auto");
  assert.equal(applyOperatingMode(rule("confirm_order"), undefined).mode, "auto");
  assert.equal(applyOperatingMode(null, "assist"), null);
});

const order = (amount) => ({ amount_vnd: amount, fields: { customer: "Khách A", items: "Gói chăm sóc", amount_vnd: amount } });

check("assist: a routine order asks (over_authority) through the gate", () => {
  const v = evaluateGate({ department: "sales", action: "confirm_order", rule: applyOperatingMode(rule("confirm_order"), "assist"), proposal: { summary: "", ...order(5_000_000) } });
  assert.equal(v.verdict, "ask");
  assert.equal(v.reason, "over_authority");
});
check("routine: order under the limit runs by itself", () => {
  const v = gate("confirm_order", order(5_000_000));
  assert.deepEqual(v, { verdict: "auto", reason: "routine", reasons: ["routine"], missing: [] });
});
check("not_allowed: no rule", () => {
  const v = evaluateGate({ department: "sales", action: "confirm_order", rule: null, proposal: order(1) });
  assert.equal(v.verdict, "ask");
  assert.equal(v.reason, "not_allowed");
});
check("not_allowed: mode never", () => {
  const v = evaluateGate({ department: "sales", action: "send_care", rule: rule("send_care", { mode: "never" }), proposal: { summary: "", fields: {} } });
  assert.equal(v.reason, "not_allowed");
});
check("missing_data: order without an amount", () => {
  const v = gate("confirm_order", { amount_vnd: null, fields: { customer: "Khách A", items: "Gói", amount_vnd: null } });
  assert.equal(v.reason, "missing_data");
  assert.deepEqual(v.missing, ["amount_vnd"]);
});
check("missing_data: handoff without a need", () => {
  const v = gate("handoff_lead", { fields: { contact_name: "Khách A", need: "  " } });
  assert.equal(v.reason, "missing_data");
  assert.deepEqual(v.missing, ["need"]);
});
check("over_authority: order over the limit", () => {
  const v = gate("confirm_order", order(45_000_000));
  assert.equal(v.verdict, "ask");
  assert.equal(v.reason, "over_authority");
});
check("over_authority: mode ask (follow-up)", () => {
  const v = gate("send_follow_up", { fields: { contact: "84901234567" } });
  assert.equal(v.reason, "over_authority");
});
check("unclear_outcome: low classification confidence", () => {
  const v = gate("classify_lead", { confidence: 0.4 });
  assert.equal(v.reason, "unclear_outcome");
});
check("unclear_outcome: payment with zero candidates", () => {
  const v = gate("reconcile_payment", { amount_vnd: 5_000_000, candidates: [] });
  assert.equal(v.reason, "unclear_outcome");
});
check("unclear_outcome: payment with two candidates", () => {
  const c = { id: "i", label: "INV", amount_vnd: 5_000_000 };
  assert.equal(gate("reconcile_payment", { amount_vnd: 5_000_000, candidates: [c, { ...c, id: "j" }] }).reason, "unclear_outcome");
});
check("routine: payment with exactly one candidate", () => {
  const c = { id: "i", label: "INV", amount_vnd: 5_000_000 };
  assert.equal(gate("reconcile_payment", { amount_vnd: 5_000_000, candidates: [c] }).verdict, "auto");
});
check("all reasons collected, precedence order kept", () => {
  const v = gate("confirm_order", { amount_vnd: 45_000_000, confidence: 0.2, fields: { customer: "", items: "x", amount_vnd: 45_000_000 } });
  assert.deepEqual(v.reasons, ["missing_data", "over_authority", "unclear_outcome"]);
  assert.equal(v.reason, "missing_data");
});
check("limit boundary: confirm_order auto strictly below 20M (19,999,999 auto; 20,000,000 and 20,000,001 ask)", () => {
  assert.equal(gate("confirm_order", order(19_999_999)).verdict, "auto");
  assert.equal(gate("confirm_order", order(20_000_000)).reason, "over_authority");
  assert.equal(gate("confirm_order", order(20_000_001)).reason, "over_authority");
});
check("limit boundary: issue_invoice auto strictly below 20M", () => {
  const inv = (a) => ({ amount_vnd: a, fields: { customer: "Khách A", amount_vnd: a } });
  assert.equal(gate("issue_invoice", inv(19_999_999)).verdict, "auto");
  assert.equal(gate("issue_invoice", inv(20_000_000)).reason, "over_authority");
  assert.equal(gate("issue_invoice", inv(20_000_001)).reason, "over_authority");
});
check("limit boundary: reconcile_payment auto strictly below 50M", () => {
  const pay = (a) => ({ amount_vnd: a, candidates: [{ id: "i", label: "INV", amount_vnd: a }] });
  assert.equal(gate("reconcile_payment", pay(49_999_999)).verdict, "auto");
  assert.equal(gate("reconcile_payment", pay(50_000_000)).reason, "over_authority");
  assert.equal(gate("reconcile_payment", pay(50_000_001)).reason, "over_authority");
});
check("limit boundary: send_quote with a limit (mode auto) auto strictly below it", () => {
  const r = rule("send_quote", { mode: "auto", limit_vnd: 10_000_000 });
  const q = (a) => evaluateGate({ department: "sales", action: "send_quote", rule: r, proposal: { summary: "", fields: {}, amount_vnd: a } });
  assert.equal(q(9_999_999).verdict, "auto");
  assert.equal(q(10_000_000).reason, "over_authority");
  assert.equal(q(10_000_001).reason, "over_authority");
});
check("isOverLimit: null limit or amount never over; equal is over", () => {
  assert.equal(isOverLimit(null, 1e12), false);
  assert.equal(isOverLimit(20_000_000, null), false);
  assert.equal(isOverLimit(20_000_000, 20_000_000), true);
  assert.equal(isOverLimit(20_000_000, 19_999_999), false);
  assert.equal(isOverLimit(0, 0), true);
});
check("approval scope: a Sales order approval never covers Accounting's invoice (priorApproval ignored)", () => {
  const p = { amount_vnd: 45_000_000, fields: { customer: "Khách A", amount_vnd: 45_000_000 } };
  assert.equal(gate("issue_invoice", p).reason, "over_authority");
  assert.equal(gate("issue_invoice", p, { priorApproval: { amount_vnd: 45_000_000 } }).reason, "over_authority");
  assert.equal(gate("issue_invoice", p, { priorApproval: { amount_vnd: 100_000_000 } }).verdict, "ask");
  // only the invoice's own decision (resumeWork on that item → humanApproved) lets it through
  assert.equal(gate("issue_invoice", p, { humanApproved: true }).verdict, "auto");
});
check("humanApproved skips the limit and the ask mode", () => {
  assert.equal(gate("confirm_order", order(45_000_000), { humanApproved: true }).verdict, "auto");
  assert.equal(gate("send_follow_up", { fields: { contact: "a@b.vn" } }, { humanApproved: true }).verdict, "auto");
});
check("humanApproved never supplies missing data", () => {
  const v = gate("issue_invoice", { amount_vnd: null, fields: { customer: "Khách D" } }, { humanApproved: true });
  assert.equal(v.reason, "missing_data");
  assert.deepEqual(v.missing, ["amount_vnd"]);
});
check("humanApproved does not skip unclear unless a candidate was chosen", () => {
  const c = { id: "i", label: "INV", amount_vnd: 1 };
  assert.equal(gate("reconcile_payment", { amount_vnd: 1, candidates: [c, { ...c, id: "j" }] }, { humanApproved: true }).reason, "unclear_outcome");
  assert.equal(gate("reconcile_payment", { amount_vnd: 1, candidates: [c] }, { humanApproved: true }).verdict, "auto");
});
check("missingFields reads amount_vnd from the proposal", () => {
  assert.deepEqual(missingFields(rule("send_quote"), { summary: "", fields: {}, amount_vnd: 10 }), []);
});
check("chain: order → invoice, payment → care, lead → classify → follow-up", () => {
  assert.deepEqual(FLOW_NEXT.confirm_order, ["issue_invoice"]);
  assert.deepEqual(FLOW_NEXT.reconcile_payment, ["send_care"]);
  assert.deepEqual(FLOW_NEXT.handoff_lead, ["classify_lead"]);
  assert.deepEqual(FLOW_NEXT.classify_lead, ["send_follow_up"]);
  for (const r of DEFAULT_RULES) assert.equal(ACTION_DEPARTMENT[r.action], r.department);
  assert.equal(DEFAULT_RULES.length, 10);
});

const KNOWLEDGE = `Bảng giá:
- Gội đầu dưỡng sinh lẻ: 350.000đ/buổi
- Gói gội đầu dưỡng sinh 10 buổi: 5.000.000đ
- Gói massage 5 buổi: 2,5 triệu
- Chăm sóc da: 800k
Mở cửa 9h - 21h, 7 ngày/tuần, năm 2026.
Thông tin chuyển khoản: Vietcombank 0123456789 - CONG TY SPA HOA MAI`;

check("knowledge: prices in every written form", () => {
  const p = pricesInKnowledge(KNOWLEDGE);
  for (const v of [350_000, 5_000_000, 2_500_000, 800_000]) assert.ok(p.includes(v), String(v));
  for (const v of [9, 10, 21]) assert.ok(!p.includes(v), String(v));
});
check("knowledge: an order price must be written by the owner (never invented)", () => {
  assert.equal(isKnownPrice(KNOWLEDGE, 5_000_000), true);
  assert.equal(isKnownPrice(KNOWLEDGE, 3_500_000), false); // 10 x 350k is not a listed package price
  assert.equal(isKnownPrice("", 5_000_000), false);
  assert.equal(isKnownPrice(KNOWLEDGE, null), false);
  assert.equal(isKnownPrice(KNOWLEDGE, 0), false);
});
check("knowledge: the bank transfer line is read only when present", () => {
  assert.equal(transferDetails(KNOWLEDGE), "Vietcombank 0123456789 - CONG TY SPA HOA MAI");
  assert.equal(transferDetails("Bảng giá: 5 triệu"), null);
  assert.equal(transferDetails(null), null);
});
check("bank: transfer content names the exact record code (with or without separators)", () => {
  assert.equal(mentionsCode("INV-202609-0021 NGUYEN VAN MINH CK", "INV-202609-0021"), true);
  assert.equal(mentionsCode("inv2026090021 thanh toan", "INV-202609-0021"), true);
  assert.equal(mentionsCode("INV 202609 0021", "INV-202609-0021"), true);
  assert.equal(mentionsCode("INV-202609-00211", "INV-202609-0021"), false);
  assert.equal(mentionsCode("CK chuyen tien", "INV-202609-0021"), false);
  assert.equal(mentionsCode("INV-202609-0021", null), false);
});

console.log(`\npolicy-check: ${passed} checks passed`);
