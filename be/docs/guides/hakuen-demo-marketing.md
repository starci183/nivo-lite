# HAKUEN demo: AI Marketing (DEMO-NOTES, marketing part)

Module: `be/src/modules/domain/content-ai (content agent services)` (GraphQL: `be/src/features/api/content-ai`). Card payloads and the Hub mapping:
`D:/starci-tmp/nivo-demo/contracts/marketing-cards.md` (copied into the integration notes).

## Real

- Brand kit from the guideline PDF: `proposeBrandKit` reads the PDF with unpdf (documents integration), one LLM call
  (`purpose: brand_kit`) extracts colors, fonts, tone, address, imagery, avoid; the proposal is a confirm card; only
  `decideBrandProposal(confirm)` writes the kit to the Second Brain (owner facts citing the guideline), `content_settings.brand_*` / `brand_voice` / `avoid` and `video_brand_kits` colors; draft cards record their sources.
- "@AI Marketing <request>": `content.draft_post` (needs payload `request`) is performed by `ContentAgentPerformersService`:
  LLM draft (caption, hashtags, two image texts, 15 s script) in the confirmed brand, two 1200x800 images composed with
  ffmpeg (brand palette, workspace media-library photos, logo, Be Vietnam Pro), content item stored, `publish_post`
  decision opened (always ask), cards `draft_post` and `approval_request`.
- Approval: the existing publish_post approval runs, then the post is scheduled: Meta Page post with
  `published=false` + `scheduled_publish_time` (photos uploaded unpublished), Zalo OA article created; card
  `schedule_confirmed` with each channel's ref or reason.
- Insights: Meta Page insights (`page_impressions_unique`, `page_post_engagements`) upserted into
  `content_engagement_daily`; weekly report (last complete Vietnam week vs the week before); card `weekly_report`.

## Shortcuts (not production complete)

- Cards are Office lines with a one-line text until the Hub card writer is wired (`MarketingCardsService.emit`).
- The draft runs in the API process after `draft_post` is performed (fire and forget, logged on failure), not on a queue.
- Publish moment: the requested `scheduled_at` when 15+ minutes ahead, else the next day 09:00 (+07).
- Zalo Article API has no publish time: the article is created hidden (`status: hide`); publishing it at the moment is not
  automated yet.
- Insights sync and the weekly report run on demand (`postMarketingWeeklyReport`); no scheduled job yet. `messages`
  per day is not filled (0) and Zalo engagement is not read.
- Front end (setup-chat attachment + brand card, Hub card renderer, "Hiệu quả" tab) is not in this branch.
