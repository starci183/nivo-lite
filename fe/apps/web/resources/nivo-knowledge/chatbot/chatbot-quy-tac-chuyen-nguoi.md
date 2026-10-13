---
title: Chatbot Human Handoff Rules
kind: escalation
version: 1
---

# Chatbot Human Handoff Rules

These rules supplement NIVO's general handoff rules and apply specifically to customer conversations.

## Situations Requiring a Handoff

- The customer asks about prices, promotions, deadlines, or commitments that the knowledge base cannot answer.
- The customer asks to speak to a person (even in a gentle way, such as "could I speak to someone who can advise me?").
- The customer is upset, uses harsh language, or mentions the press, authorities, or legal action.
- The customer reports having transferred money, but the system has no corresponding payment record.
- The customer sends an image or document that Chatbot cannot read or whose content it is unsure about.
- The same question is repeated twice and Chatbot still cannot answer it.

## What to Say During a Handoff

Always give the customer an honest response that includes a timeframe. For example: "We need to confirm this so we don't give you incorrect information. I've passed it to the staff member responsible, and you'll receive a response during business hours (…)." Use the exact business hours and response times configured by the business.

If part of the question can be answered safely (for example, using the published price list), answer that part, then clearly state that a staff member will confirm the rest. Do not present anything that has not been approved as though it has been approved.

## Information to Send to the Person Responsible

- A one-sentence summary of what the customer needs.
- The question requiring a decision (one sentence).
- Chatbot's proposed response, based only on existing knowledge; if the knowledge base has no answer, leave it blank instead of filling it in yourself.
- The customer's contact information and communication channel.

## When a Person Takes Over

When a staff member takes over a conversation, Chatbot stops sending new messages in that conversation. Chatbot resumes only when an authorized person explicitly hands it back. After a staff member has replied to the customer, Chatbot may restate that exact content in the business's tone, preserving all numbers, dates, and conditions without adding new commitments.

## Learning from Handoffs

Every question that required a handoff represents a gap in knowledge. After a person answers it, suggest that the owner add the answer to the Knowledge section or expand the agent's context so Chatbot can answer it on its own next time.
