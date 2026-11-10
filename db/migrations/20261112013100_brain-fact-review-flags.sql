-- brain-fact-review-flags: forward-only; immutable once on origin/main. Expand only: one new column with a default, one check, and a
-- data step that only clears a cache (nothing is dropped, no row is deleted). BG2 (BRAIN wave, 2026-11-12).
-- 1. review_flags on public.brain_facts: what the brain noticed on a proposal that the founder must see before deciding it.
--    'stale'        = its stated end had already passed when it was filed (a document says "valid until 30/06" in November);
--                     approving it records it as history (expired), it never comes in force.
--    'same_meaning' = the model judged it the SAME fact as another one written in other words; conflict_with names that fact and
--                     approving it merges (the other value in force is superseded, or the other waiting proposal is rejected).
--    A flagged proposal is never applied in bulk. Every fact read selects the column: apply this BEFORE the new code boots.
-- 2. The fact reading's prompt changed (PROMPT_VERSION 1 -> 2: end dates, a quote that must hold its value). A source whose text is
--    unchanged is skipped by the index job before its facts (knowledge_sources.content_hash = "the passages and facts of this text are
--    complete"); for a source whose finished reading used an older prompt that is no longer true, so its hash is cleared and its NEXT
--    index job (an upload of the same text, a reindex, a Drive sync) reads its facts again with the new prompt. Passages keep their
--    vectors (their own hashes are untouched): only the facts reading is paid again. Nothing is queued here.
--    Until a source is indexed again its hash is null, which the code reads as "work unfinished": the drafting read
--    (brain.documents.read) and the public-document drafts skip it, and it is not a twin for duplicate detection.

ALTER TABLE public.brain_facts ADD COLUMN review_flags text[] NOT NULL DEFAULT '{}'::text[];
ALTER TABLE public.brain_facts ADD CONSTRAINT brain_facts_review_flags_check
    CHECK ((review_flags <@ ARRAY['stale'::text, 'same_meaning'::text]));

UPDATE public.knowledge_sources AS s
   SET content_hash = NULL
  FROM public.brain_extractions AS e
 WHERE e.source_id = s.id
   AND e.workspace_id = s.workspace_id
   AND e.prompt_version < 2
   AND s.content_hash IS NOT NULL;
