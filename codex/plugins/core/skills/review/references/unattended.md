# Unattended snapshot entry point

Execution context: unattended-snapshot. There is nobody available to answer menus. The caller
supplies an explicit resolved mode, immutable inputs and an output schema. Read the shared
review-common.md and the selected mode reference. Do not run the interactive menu, gather,
artifact or write-back steps in SKILL.md. The caller owns those operations and publication.
Never promote to Ultra without an explicit request. Preserve read-only snapshot isolation.

Do not run builds, tests, apps, git, or GitHub commands. CI owns the full build and
test run. If only targeted execution can settle a finding, set needs_run and
describe the needed check in questions. No successful execution may be claimed
without evidence in the supplied context.

Return only the caller's structured result, using its supplied schema. Do not add a report or
mode field yourself; the caller records provenance and renders Ultra's verified report. Never
claim tests ran unless the supplied evidence proves it.

The caller executes the Ultra roster and verification. Each model invocation performs only its designated seat or verifier role; never start another panel or delegate from inside a snapshot review.
