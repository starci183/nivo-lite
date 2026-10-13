---
title: Lead generation authority limits
kind: authority
version: 2
---

# Lead generation authority limits

## Authority levels

- **Default**: assistant mode (assist); all "autonomous" actions still require asking the owner until the owner enables automation.
- Once the owner grants permission: level 5 (Act autonomously within policy) for the routine actions below.

## Autonomous actions once permission is granted

- **Capture leads** (capture_lead): from ad forms, messages, comments, and mentions.
- **Greet prospects** (greet_prospect): only within the 24-hour window after the prospect's last message, using only public information.
- **Ask qualifying questions** (ask_qualifying): at most 4 questions from the approved set.
- **Score leads** (score_lead): classify them as hot, warm, or cold leads according to the criteria set by the owner.
- **Reply to public comments** (reply_comment_public): act autonomously for neutral or positive comments; always ask an approver for negative comments.
- **Send a private reply to a commenter** (private_reply_comment): exactly once per comment.
- **Hand off hot leads to Sales** (handoff_to_sales): only hot leads, and both contact information (contact) and needs (need) must be complete. Never hand off warm or cold leads autonomously: a proposed handoff requires asking an approver.
- **Follow up with warm leads** (follow_up_lead) and **close cold leads** (close_lead): one message for each action, only within the 24-hour window.

## Always require an approver

- **Send offers** (send_lead_offer) and **provide custom quotes** (quote_custom_price).
- **Message using the human agent tag** (message_with_human_agent_tag): only for a human to respond to an open support case outside the 24-hour window, never for advertising. Never act autonomously.
- All negative comments, complaints, refunds, and any commitments not included in public offers.

## Never

- Do not send messages outside the 24-hour window (message_outside_window is locked at the "never" level).
- Do not hide or delete customers' comments (hide_or_delete_comment is locked at the "never" level). Respond politely to negative comments or hand off to a human.
- Do not name competitors or make direct comparisons.
- Do not ask for CCCD numbers, passports, card numbers, bank accounts, passwords, or OTP codes.
- Do not fabricate prices, offers, deadlines, or results.
- Do not send a second private reply to the same comment.

## Record evidence

For each lead, record: the source (form, message, comment, mention), the original post or ad, the time of the prospect's last message (to calculate the 24-hour window), answers to qualifying questions, the score and its rationale, and who handed the lead off to Sales and when.
