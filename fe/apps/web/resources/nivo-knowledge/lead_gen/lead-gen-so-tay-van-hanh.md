---
title: Lead generation operating playbook
kind: playbook
version: 2
---

# Lead generation operating playbook

## Purpose

Lead generation captures prospects from Facebook and Instagram (lead ad forms, Messenger and Instagram messages, comments on posts, and Instagram mentions), qualifies them with up to 4 questions, scores them as hot, warm, or cold, and hands hot leads off to Sales.

## The 24-hour window

1. Messages may only be sent within 24 hours of the prospect's last message. Each message the prospect sends reopens the 24-hour window.
2. Before sending each message, check the time of the prospect's last message. If the window has expired, do not send it; mark the lead as "waiting for the prospect to message again" and notify the person in charge.
3. The only exception is the human agent tag for an open support case, which always requires human approval and must never be used for advertising.
4. Comments also support private replies; see the section below.

## Workflow

1. **Capture**: create a lead with the source, original post or ad, name, contact information, and time of the last message. Merge duplicate records for the same person instead of creating another lead.
2. **Greet**: use public information and one open-ended question.
3. **Qualify**: ask up to 4 approved questions, one at a time. If the prospect does not want to answer, stop and do not ask again.
4. **Score**: assign hot, warm, or cold according to the owner's criteria and record a brief reason.
5. **Act on the score**: hand hot leads off to Sales; send warm leads public information and keep them on the waiting list; thank cold leads and stop.

## Lead states

`new` (just captured) → `greeted` (greeted) → `qualifying` (asking questions, one per turn, up to 4) → one of three outcomes:

- **`handed_off`**: a hot lead with complete contact information and needs details has been handed off to Sales (the classify_lead command). Stop asking questions as soon as the lead meets the hot-lead criteria.
- **`nurturing`**: a warm lead receives exactly one follow-up message within the 24-hour window; outside the window, Sales drafts a follow-up message for human approval.
- **`closed`**: a cold lead receives one polite thank-you message within the 24-hour window (outside the window, close silently). Reopen if the prospect messages again.
  Prospects from ad forms or mentions have no messaging window: score them immediately (`scored`), hand hot leads off to Sales, have Sales follow up with warm leads, and close cold leads.
  When human involvement is needed (complaints, refunds, frustration, requests for a real person, confidence below 0.6, or questions the knowledge base cannot answer), the lead moves to `escalated`: the bot stops until a person hands the conversation back.

Each prospect message turn uses at most one AI model call (to interpret free-form answers as signals: needs, contact information, budget, timing, area, and sentiment). Rules calculate the hot, warm, or cold score; the model does not decide it.

## Public comments

- Reply briefly in public to comments expressing interest and invite prospects to check their private messages.
- Neutral or positive comments: reply automatically when authorized. Negative comments: draft a reply and wait for human approval.
- Do not hide or delete prospects' comments. Do not argue in the comments on a post.
- Do not include phone numbers, email addresses, or personal information in public comments.

## One-time private replies

- For each comment, a private reply may be sent exactly once. Record the ID of the comment that received a reply; if the prospect sends another message, continue with regular messages within the 24-hour window.
- The first private message must refer to the post or ad the prospect commented on and must not contain lengthy advertising.

## When to escalate to a person

See the escalation rules: complaints, refunds, frustrated prospects, prospects asking "Are you a real person?", confidence below 0.6, or questions about prices or commitments that the knowledge base cannot answer.
