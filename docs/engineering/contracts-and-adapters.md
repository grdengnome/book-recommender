# Contracts and adapters: keeping every part swappable

> **Status:** Living · Agreed Oct 28, 2026 ([decision 14.1](../decisions.md)). Describes the target design; the AI gateway is built (PR 4a), and the other contracts arrive as their parts are built ([repo restructure](./repo-guide.md)). Last updated Nov 1, 2026.

## The principle
New AI models and tools appear constantly, and Squirmly will keep changing. Changing the UI, data storage, question flow, a model, a book source or a theme must not break the rest of the app. Each part plugs into the wider infrastructure, and as many parts as reasonable follow this rule.

## How it works ("ports and adapters")
- **Every swappable part talks to the rest through a contract:** a short, written description (a TypeScript type) of what goes in and what comes out. The rest of the app only knows the contract, never the specific tool behind it.
- **Adapters plug into contracts.** Anthropic is one adapter for the AI contract; Open Library and Hardcover are adapters for the book-source contract; a database is an adapter for the storage contract. Swapping means writing a new adapter and changing one setting.
- **Settings, not code, choose the adapter.** One settings file per area, for example `lib/ai/slots.ts` (which model does which job), the active store, the active themes.
- **Content as data.** Questions, themes, rarity rules and copy live as data files, so they change without touching code.
- **Contract tests.** Each contract has a small test every adapter must pass, run on every pull request, so a swap that breaks something is caught before it merges.
- **Feature flags.** New or experimental parts (a new question format, a Three.js book) can run alongside the old version until they prove themselves.
- **Every output records which engine made it,** so a card or recommendation can always be traced to the model and source behind it.

## Model choice is never permanent (decision 14.3)
- **Every AI job has its own slot,** and each slot can use any model or provider. Today's choices (Sonnet 5 and Haiku 4.5) are where we are, not where we stop.
- **The rule is the best balance of speed and quality** for that job. A heavy judgment call (choosing the three picks) may justify a larger model; a quick check may not.
- **Changes are proven, not assumed:** each slot's eval and timing must hold or improve before a new model goes live.
- **How models run is part of the choice.** Running jobs in parallel, streaming partial results, caching repeated work, routing small jobs to fast models, and starting work early (preparing the table while the reader is still answering) are all levers. The engine already streams the selection and writes the three cards in parallel; finding more of these is an ongoing track (see the [roadmap](../product/roadmap-and-backlog.md)).
- **Re-checked when the field moves:** new models are logged in the Tool Radar and tested against a slot when that slot is next worked on.

## The guardrail: YAGNI ("You Aren't Gonna Need It")
A contract has costs: an extra layer, a guess about the future, and upkeep. Add one only when at least one of these is true:
1. **Two or more options already exist** (Open Library and Hardcover; the five themes).
2. **A swap is planned or being tested** (the image bake-off, the Three.js book, the cover enhancer test).
3. **It depends on an outside company or service** (AI models, data storage, book catalogs).
4. **It's expensive to change later** (storage and sign-in, because real readers' data ends up inside them).

Otherwise keep plain code: a screen's layout, a button style, small helpers. If a plain piece later gets a real second option, add the contract then. Placeholders for future features are a type or a short note, not empty folders.

## Contracts
| Area | Contract | v0 adapter(s) | Could be swapped for |
|---|---|---|---|
| AI jobs | `AiSlot` per job, through `lib/ai/gateway.ts` + `slots.ts` | Anthropic: Sonnet 5 (taste → tags, picks, card writing), Haiku 4.5 (field shortening, description check) | Any model or provider, per job |
| Book sources | `BookSource` | Open Library, Hardcover | Google Books, ISBNdb, curated lists |
| Covers | `CoverSource`, `CoverEnhancer` | Open Library / Hardcover covers; EDSR-class faithful upscaler | Stronger upscalers, paid cover sources |
| Images | `ImageGenerator` (asset pipeline, not run per request) | Image bake-off winner | Any generator, or a trained Squirmly style model |
| Storage | `Store` (feedback, rate-limit counters, card bank, logs) | One chosen data store | Any database |
| Question flow | `QuestionBank` (data), `QuestionChooser`, `TasteProfile` | v2 bank, simple chooser | New formats, a smarter chooser |
| Themes | `Theme` (tokens, scenes, wrapping, copy, motion) | Café, Mystery, Fantasy, Superhero, Sci-fi | New and seasonal themes |
| Reveal | `RevealBook` renderer, `RevealAnimation` | CSS 3D book; v0 animation set | Three.js book; new animations |
| Security | `InputGuard`, `RateLimiter` | Basic guard; per-visitor limit | Stronger guard, another limiter |
| Later | `Auth`, `Analytics`, `Shelf`, `Ranking`, `Collection`, `Notifications` | Placeholder types only | Chosen when built |

## Where the code stands (audit, Oct 27)
- **Already close:** each AI job lives in its own file; Open Library and Hardcover are separate modules joined in one merge step; `lib/output/pickSchema.ts` defines the pick and card shapes; `lib/trace/` records which model ran each call, with tokens and cost (local only).
- **Done (PR 4a):** every model call goes through `lib/ai/gateway.ts`; `slots.ts` picks each job's model, and an `AI_SLOT_<JOB>` setting can override one for an experiment. Requests still use Anthropic's message format; a provider-neutral format arrives with the first non-Anthropic adapter.
- **To do:** book sources return different shapes with no shared contract; there are no per-slot test sets; production doesn't record which engine made each output (arrives with the data store).
- **Not built yet, so built on contracts from day one:** the app screens, covers and the cover enhancer, illustration, the reveal renderer, storage and security.
