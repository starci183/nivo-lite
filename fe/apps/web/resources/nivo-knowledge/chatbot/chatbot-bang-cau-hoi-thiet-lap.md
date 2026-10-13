---
title: Chatbot Setup Questionnaire
kind: setup_checklist
version: 1
---

# Chatbot Setup Questionnaire

The Chatbot should only go live once the owner has confirmed the information for the items below. Each item corresponds to a "gate" on the Setup screen. Ask about one item at a time and record the answer. If the information is already available in Business Knowledge, do not ask for it again: summarize it and ask the owner to confirm.

## identity — Business Information

Required: the business name, what it does, which customer groups it serves, and its location or service area.
Suggested question: "Could you introduce your business: its name, what you do, and who your customers are?"
Complete when: the name, type of service or product, and at least one detail identifying the customers or area are available.

## products — Products, Services, and Prices (if Sold to Customers)

Applies when the business sells or provides something to customers. If the owner says they do not sell directly, have no price list, or only use NIVO internally, record "not applicable" and consider this item complete. Do not ask about it again.
Required (when applicable): the main products or services, prices or how quotes are provided, and any additional charges.
Suggestion: if the list is long, ask the owner to add it as a source in Knowledge (under any topic, such as "Services") instead of typing it in chat.
Complete when: the main items have prices or clear pricing rules, or the owner confirms that this item does not apply. Do not fill in prices on the owner's behalf.

## support_scope — Support Scope

Required: which categories of questions the Chatbot may answer, which categories staff should handle, and prohibited topics.
Complete when: there is an "allowed to answer" list and a "do not answer" or handoff list.

## channels — Incoming Channels

Required: where customers send messages (website, Telegram, Zalo, Facebook...), and which channel to enable first.
Complete when: at least one channel is listed and its connection status is known.

## hours_sla — Business Hours and Response Time

Required: opening hours, days off, and how long it takes a human to respond to a handed-off question.
Complete when: specific hours and a response-time commitment accepted by the owner are available.

## handoff — When to Hand Off to a Human

Required: situations requiring a handoff, the recipient (name or role), and the internal communication channel.
Complete when: there are at least three situations and one specific recipient.

## prohibited — Prohibited Promises

Required: commitments the bot must never make on its own (custom prices, discounts, warranties, refunds, deadlines).
Complete when: the owner has listed them or confirmed that NIVO's default limits are sufficient.

## tone — Tone

Required: how to address customers, the level of formality, whether to use emoji, and phrases to use or avoid.
Complete when: there is a form of address and a style description (or a sample response the owner likes).

## Items That Do Not Apply

Not every item applies to every business. When the owner explicitly says that an item does not apply ("we do not have a price list", "we do not use Zalo yet"), the agent records a brief reason, considers the item answered, and does not ask about it again. Only revisit it if the owner changes their mind.

## How to Ask Questions in the Setup Chat

- Ask about only one incomplete item per turn, prioritizing the items that block the most work (products, support_scope).
- After each answer: briefly acknowledge it, record it, then move to the next item.
- If the answer is long (a price list or return policy), suggest adding a document to Knowledge.
- When all items have information, remind the owner to review the right-hand side and click "Apply".
