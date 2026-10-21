# AI Editor: delegated video renders (HAKUEN demo, N19/N20)

AI Editor is the `video` module's agent (catalog name "AI Editor"). Another agent hands it a script with the
command-bus command `video.render_script`; the caller contract is in `be/src/modules/domain/video/editor-delegation.policy.ts`
(fields) and `be/src/modules/domain/video/editor-delegation.contracts.ts` (types). AI Marketing sends it after each draft from
`be/src/modules/domain/content-ai/marketing-video.service.ts` (dedupe key `render_script:<contentItemId>`).

Flow: `render_script` work item (gate `auto`) -> `EditorDelegationPerformerService` creates the `video_projects` row and a
`video_delegations` row and queues the real render (`VideoService.requestDelegatedRender`, brand kit + brand frame) ->
render-video job -> `EditorDeliveryService.settle` opens the `publish_video` work item (dedupe
`publish_video:<project>:<render>`), posts the `video_ready` card whose ref/buttons decide it, then a one-line approval ask -> the existing approval performer approves the project.

## DEMO-NOTES (AI Editor)

Real: the render (ffmpeg, VTT captions, TTS when configured, captions-only with `VIDEO_TTS_PROVIDER=none`), the brand kit and
the brand frame, the delegation record, the approval work item and its decision path.

Shortcuts of this build:

- Hub cards: `EditorRoomService.post` posts the `video_ready` card through `OfficeCardsService.postAsDepartment` (dept
  `video`, room `marketing`) with its one-line preview; the same v1 card JSON is also kept in `video_delegations.card`.
- The card's links are 3-day signed URLs taken when the card is posted; an older card needs the workbench to re-sign.
- The brand frame is always on for delegated renders and off for workbench renders (no brand-kit toggle yet).
- `video_delegations.status` stops at `ready`/`failed`; approval is read from `video_projects.status`.
- Render progress: when the render is queued, AI Editor posts a `handoff_note` card in the Marketing room (title, scenes,
  planned length, badge "rendering") whose link opens the video project, where the progress bar runs live; the `video_ready`
  card follows when the render ends.
- Publishing the approved video to the target channels stays with AI Marketing's publishing path.
- Layer 3 (editing style learned from approvals) is not wired; the card's `data.sources` names the layers used (layer 2:
  the workspace brand kit and the delegated script).

## Reuse

Extended: `video` (performer, delivery, brand frame in the render plan, `VideoService.requestDelegatedRender`), `video-projects`
(`createDelegated`), `video-brand-kits` (read unchanged through the render spec), `decisions` (command bus `render_script`
accept, `video_project` subject type, the existing `publish_video` approval performer), `messages` (`OfficeLinesService`).
New only where nothing existed: the `video_delegations` table and its owner capability `video-delegations` (no existing
record of agent-to-agent delegations; the table-owner rule requires a capability named for the table).
