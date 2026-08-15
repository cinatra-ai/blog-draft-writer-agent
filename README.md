# Blog Draft Writer Agent

Turn a blog idea into a polished markdown draft, ready to review and publish. Hand the agent one idea as a single line of free text, then dial in tone, length, audience, and voice. The agent writes a draft with a working title, a short excerpt, and a clean markdown body, optionally weaving in your reference content and citing your sources. It is a stateless, LLM-only leaf: no web search, no tool calls, no stored state. For fresh research, chain a web-research agent upstream into `referenceContent`.

The required input is an `idea` object (`{title, summary, outline}`) of which only `title` is required. The setup form is ONE field named Idea and submits `{"title": "<your text>"}`; the agent derives the summary and outline from it and says so in `notes`. An empty Idea is refused before the run resumes. Optional inputs include `tone` (default `informative`; also `casual`, `technical`, `executive`, or free-form), `length` (default `medium` ≈ 800 words; also `short` ≈ 400, `long` ≈ 1500, or a free-form `"1200 words"` pattern), `audience`, `voice` (brand voice instructions or examples), `referenceContent` (background material used without attribution), and `sources` (an array of `{title, url}` objects cited inline). The output is `title`, `excerpt`, `content` (markdown), and a `sourcesUsed` list, plus a `notes` string of operator-readable caveats. The platform persists `content` as a `@cinatra-ai/blog-post-artifact` titled from `title`. An empty or non-object `idea` returns empty draft fields with a distinct `idea_was_empty_or_invalid` or `idea_was_non_object` note instead of throwing. No credentials are required; the platform routes the generation call.

## Works with

- Cinatra platform (agent runtime required)
- `@cinatra-ai/blog-idea-artifact` — optional context slot to pull a structured idea from a prior pipeline step
- `@cinatra-ai/brand-voice-artifact` — optional context slot to inject brand voice guidance into the draft

## Capabilities

- Write a complete blog draft from one free-text idea, or a full title, summary, and outline
- Adapt tone, length, audience, and voice to match the brief
- Weave reference content and brand voice into the draft without attributing the source material
- Cite caller-supplied sources inline and return used URLs in `sourcesUsed`
- Produce a reusable draft artifact the blog pipeline can pick up
- Return a graceful empty-draft response when the idea input is missing or invalid
