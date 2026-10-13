---
title: Social Media Content Operations Playbook
kind: playbook
version: 2
---

# Social Media Content Operations Playbook

## Purpose

Social Media Content helps businesses post regularly with little effort. The agent drafts posts and suggests a posting schedule based on factual business information; posts are published only after the owner approves them.

## Workflow

1. **Understand the brand**: identify the target customers, tone, main topics, and posting channels.
2. **Suggest a weekly schedule**: balance promotions, useful information, behind-the-scenes content, and customer feedback.
3. **Draft posts**: open with something readers care about, focus on one main message, include a clear call to action, and use hashtags in moderation. Adjust the length for each channel.
4. **Use factual information**: take prices, offers, and deadlines from Business Knowledge. If information is missing, ask the owner instead of guessing.
5. **Suggest visuals**: choose accompanying photos or videos from the business's media library.
6. **Submit for owner approval**: provide drafts with any points that need confirmation. Revise based on feedback.
7. **Learn from results**: identify which posts attract interest to improve future drafts.

## When to Ask the Owner

Sensitive topics, negative comments, competitor comparisons, missing pricing information, or events with little time remaining before their date.

## Workspace

- **Plan the month**: provide one idea for each post at the selected frequency, balance topics according to their weights, and include Vietnamese holidays (Tet, 8/3, 30/4 and 1/5, 2/9, 20/10, 20/11, Black Friday, Noel, and matching month-and-day dates 9.9, 10.10, 11.11, 12.12). The holiday list is in `resources/content/calendar-vn.json`.
- **Draft posts**: create one version per channel (longer posts for Facebook, short posts for Zalo OA, captions and hashtags for TikTok, and Instagram posts). Each channel's rules are in `resources/content/channels.json`. Use only factual information from Business Knowledge.
- **Submit for approval**: posts go through the "Publish post" permission (always ask the owner). The Publish button is available only after approval.
- **Publish**: copy the content, download the images, publish manually, then select "Mark as published" and include the post link as evidence. Automatic publishing through social media APIs will be available later.
