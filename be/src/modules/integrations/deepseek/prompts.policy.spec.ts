import { authorityBrief, commandProposalPrompt, langFor, NIVO, personaOf, toMessages } from "./prompts.policy"

describe("prompts policy", () => {
    it("asks for the language of the reader", () => {
        expect(langFor("vi")).toContain("Vietnamese")
        expect(langFor("en")).toContain("English")
        expect(NIVO).toContain("NIVO OS")
    })

    describe("authorityBrief", () => {
        it("is empty without authority or when nothing is set", () => {
            expect(authorityBrief(null)).toBe("")
            expect(authorityBrief({ policies: " ", reply_style: "", brand_voice: "", limits_note: "" })).toBe("")
        })

        it("lists every part that is set", () => {
            expect(
                authorityBrief({
                    policies: " Deposit 30% ",
                    reply_style: "short",
                    brand_voice: "warm",
                    limits_note: "discounts",
                }),
            ).toBe(
                "\nAuthority granted by the owner:\nBusiness policies:\nDeposit 30%\nReply style: short\nBrand voice: warm\nAlways ask the owner first when: discounts",
            )
            expect(authorityBrief({ policies: "", reply_style: "short", brand_voice: "", limits_note: "" })).toBe(
                "\nAuthority granted by the owner:\nReply style: short",
            )
        })
    })

    describe("personaOf", () => {
        it("describes the agent with its knowledge and approval rule", () => {
            expect(
                personaOf(
                    {
                        name: "Mai",
                        handle: "mai",
                        role: "Chatbot",
                        instructions: "Be kind",
                        knowledge: "Opens 9-5",
                        approval_rule: "Ask on price",
                    },
                    "\nBrief",
                ),
            ).toBe(
                "You are Mai (@mai), role: Chatbot.\nInstructions: Be kind\nBusiness knowledge: Opens 9-5\nApproval rule: Ask on price\nBrief",
            )
        })

        it("falls back when knowledge and the approval rule are missing or empty", () => {
            const bare = personaOf({ name: "Mai", handle: "mai", role: "Chatbot", instructions: "Be kind" }, "")
            const empty = personaOf(
                {
                    name: "Mai",
                    handle: "mai",
                    role: "Chatbot",
                    instructions: "Be kind",
                    knowledge: "",
                    approval_rule: "",
                },
                "",
            )

            expect(bare).toContain("Business knowledge: (none)")
            expect(bare).toContain("Approval rule: Commitments need human approval.")
            expect(empty).toBe(bare)
        })
    })

    it("maps a chat to prompt messages", () => {
        expect(
            toMessages([
                { role: "user", body: "Hi" },
                { role: "agent", body: "Hello" },
            ]),
        ).toEqual([
            { role: "user", content: "Hi" },
            { role: "assistant", content: "Hello" },
        ])
    })

    describe("commandProposalPrompt", () => {
        const option = {
            command: "issue_receipt",
            description: { vi: "xuat phieu thu", en: "issue a receipt" },
            subjectType: "order",
            requiredFields: ["amount"],
        }

        it("lists the commands, the offered references and the owner's text", () => {
            const [system, user] = commandProposalPrompt({
                agentName: "Accounting",
                options: [option, { ...option, command: "ping", requiredFields: [] }],
                customers: [{ id: "l-1", name: "Lan" }],
                orders: [{ id: "o-1", order_no: "DH-1", lead_id: null }],
                text: "receipt for DH-1",
            })

            expect(system?.content).toContain('for the agent "Accounting"')
            expect(system?.content).toContain(
                "- issue_receipt: issue a receipt / xuat phieu thu; subject=order; needs amount",
            )
            expect(system?.content).toContain("needs nothing")
            expect(system?.content).toContain('customers: [{"id":"l-1","name":"Lan"}]')
            expect(system?.content).toContain('orders: [{"id":"o-1","order_no":"DH-1","lead_id":null}]')
            expect(user).toEqual({ role: "user", content: "receipt for DH-1" })
        })
    })
})
