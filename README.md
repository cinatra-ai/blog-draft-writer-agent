# Blog Draft Writer Agent

Turn a blog idea into a polished markdown draft, ready to review and publish. Hand the agent an idea — a title, a summary, and an outline — then dial in tone, length, audience, and voice. The agent writes a structured draft with a working title, a short excerpt, and a clean markdown body, optionally weaving in your reference content and citing the sources you supply. It is a stateless, LLM-only leaf: no web search, no tool calls, no stored state. If you need fresh research before drafting, chain a web-research agent upstream and pass the results as `referenceContent`.

The required input is an `idea` object with at least `title` and either `summary` or `outline`. Optional inputs include `tone` (default `informative`; also `casual`, `technical`, `executive`, or any free-form descriptor), `length` (default `medium` ≈ 800 words; also `short` ≈ 400, `long` ≈ 1500, or a free-form `"1200 words"` pattern), `audience`, `voice` (brand voice instructions or example sentences), `referenceContent` (background material to draw from without attribution), and `sources` (an array of `{title, url}` objects that may be cited inline). The output is a `draft` object — `title`, `excerpt`, `content` (markdown), and an optional `sourcesUsed` list — plus a `notes` string with operator-readable caveats. If the `idea` input is empty or invalid, the agent returns an empty draft with `notes: "idea_was_empty_or_invalid — cannot draft"` rather than throwing. No credentials or external service access are required; the platform routes the generation call.

## Works with

- Cinatra platform (agent runtime required)
- `@cinatra-ai/blog-idea-artifact` — optional context slot to pull a structured idea from a prior pipeline step
- `@cinatra-ai/brand-voice-artifact` — optional context slot to inject brand voice guidance into the draft

## Capabilities

- Write a complete blog draft from a title, summary, and outline
- Adapt tone, length, audience, and voice to match the brief
- Weave reference content and brand voice context into the draft without attributing the source material
- Cite caller-supplied sources inline and return the used URLs in `sourcesUsed`
- Produce a reusable draft artifact the rest of the blog pipeline can pick up
- Return a graceful empty-draft response instead of throwing when the idea input is missing or invalid
