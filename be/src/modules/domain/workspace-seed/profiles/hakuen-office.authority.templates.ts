import type { OfficeAuthoritySeed } from "../office-seed.contracts"

/**
 * The rules and grants of the story, written against the v0.3.2 authority contract (plan 5.1 and 9): a discount in percent with
 * bands (alone up to 3, ask 3 to 15, never above), asked of the managers of Sales (any one), 30 minutes before it goes to the
 * agent's owner; anh Minh may approve up to 15 percent, chi Ha up to 10, Nam anything the rule allows; Van approves invoices.
 * This file only holds data. It is applied through the office authority port (authority-rules and member-grants).
 */
export const HAKUEN_OFFICE_AUTHORITY: OfficeAuthoritySeed = {
    rules: [
        {
            department: "sales",
            action: "give_discount",
            unit: "percent",
            auto_max: 3,
            ask_max: 15,
            approver_group: { roles: ["manager"], rooms: ["sales"], members: [] },
            approval_policy: "any",
            timeout_minutes: 30,
            agents: ["sales"],
            required_fields: ["customer"],
            note: "Gi\u1ea3m \u0111\u1ebfn 3% t\u1ef1 l\u00e0m; 3\u201315% c\u1ea7n qu\u1ea3n l\u00fd Sales duy\u1ec7t; tr\u00ean 15% kh\u00f4ng bao gi\u1edd.",
        },
        {
            department: "accounting",
            action: "issue_invoice",
            unit: "vnd",
            auto_max: 20_000_000,
            ask_max: 500_000_000,
            approver_group: { roles: [], rooms: ["accounting"], members: ["van"] },
            approval_policy: "any",
            timeout_minutes: 30,
            agents: ["accounting"],
            required_fields: ["customer", "amount_vnd", "tax_code"],
            note: "Xu\u1ea5t ho\u00e1 \u0111\u01a1n \u0111\u1ebfn 20 tri\u1ec7u t\u1ef1 l\u00e0m; tr\u00ean \u0111\u00f3 c\u1ea7n V\u00e2n duy\u1ec7t.",
        },
        {
            department: "chatbot",
            action: "reply_customer",
            unit: "count",
            auto_max: 1,
            ask_max: 1,
            approver_group: { roles: ["manager"], rooms: ["care"], members: [] },
            approval_policy: "any",
            timeout_minutes: 30,
            agents: ["care"],
            required_fields: [],
            note: "AI CSKH t\u1ef1 g\u1eedi m\u1ed9t tin x\u00e1c nh\u1eadn cho kh\u00e1ch; nhi\u1ec1u h\u01a1n c\u1ea7n qu\u1ea3n l\u00fd CSKH.",
        },
    ],
    grants: [
        { member: "minh", action: "give_discount", unit: "percent", limit: 15 },
        { member: "ha", action: "give_discount", unit: "percent", limit: 10 },
        { member: "nam", action: "give_discount", unit: "percent", limit: 15 },
        { member: "van", action: "issue_invoice", unit: "vnd", limit: 500_000_000 },
        { member: "nam", action: "issue_invoice", unit: "vnd", limit: 500_000_000 },
    ],
}
