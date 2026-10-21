# HAKUEN demo: AI Marketing (DEMO-NOTES, marketing part)

Module: `be/src/modules/domain/content-ai` (the content agent services; GraphQL in `be/src/features/api/content-ai`). Card
payloads: `be/src/modules/domain/content-ai/marketing-cards.contracts.ts`; the Hub card mapping is
`be/src/modules/domain/content-ai/marketing-cards.service.ts`.

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
- Drafts read layer 3 and layer 4 (`MarketingKnowledgeService`): the approved lessons of the content agent
  (`BrainLessonsService.forModule`) and the NIVO marketing templates closest to the request (the `nivo` passages of
  `KnowledgeSearchService.passages`). Both go into the prompt and onto the `draft_post` card as sources; a failed read leaves
  that layer out.
- Zalo OA publish at the moment: the article is created hidden when the post is approved; the quarter-hour AI Marketing tick
  (`marketing_tick` queue scheduled by pg_cron, job `be/src/features/jobs/run-marketing-tick`) runs `ContentScheduleService.publishDue`, which verifies the
  creation token, shows the article and records the channel as published. Zalo unreachable retries on the next tick; a refusal
  is recorded on the post (`published.zalo.failed_at`) and posted as a `schedule_confirmed` card with the reason.
- Insights (`MarketingChannelsService.sync`): Meta Page insights (`page_impressions_unique`, `page_post_engagements`) and the
  messages customers wrote per Vietnam day on Facebook and Zalo OA (counted from the customer conversations NIVO received)
  are upserted into `content_engagement_daily`; weekly report (last complete Vietnam week vs the week before); card
  `weekly_report`.
- Top posts: the Page posts of the week from Meta (`published_posts` with the `post_engagements` insight) and the shown Zalo
  OA articles (`/v2.0/article/getslice`, views plus shares), ranked top four by engagements.
- Suggestion: one LLM call per week (`purpose: marketing_report`, `MarketingSuggestionService`) reads the week's numbers,
  the top posts and the confirmed brand tone and answers one suggestion for the next week; it carries its sources (layer 1
  Page insights, customer messages, published posts, Zalo articles; layer 2 brand kit). A failed or unreadable answer leaves
  the suggestion empty.
- Report store: the top posts and the suggestion are kept per workspace and week in `content_weekly_reports` (owner
  `be/src/modules/domain/content-weekly-reports`). A week computed after it ended is shown from the store; a running week is
  recomputed when its extras are older than an hour.
- Weekly job: the same AI Marketing tick posts last week's `weekly_report` card once per workspace from Monday 08:00 (Vietnam
  time), for a workspace with a connected Page or OA; the week's posting claim (`content_weekly_reports.posted_at`) makes a
  repeat tick, or an earlier `postMarketingWeeklyReport`, skip it.

## Shortcuts (not production complete)

- Cards are posted through `OfficeCardsService.postAsDepartment` in the Marketing room, with the catalog line as preview.
- The draft runs in the API process after `draft_post` is performed (fire and forget, logged on failure), not on a queue.
- Publish moment: the requested `scheduled_at` when 15+ minutes ahead, else the next day 09:00 (+07).
- Zalo publishes within the quarter hour after the moment (the tick period), not at the exact minute.
- Zalo has no per-day engagement figure: the chart shows Facebook engagements per day; Zalo adds its messages per day and its
  articles to the top posts.
- The stored suggestion keeps the language of the first reader of the week.
