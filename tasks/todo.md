# Internal task list

- [x] Task 1: Write the foundation specification
  - Acceptance: roles, channels, content delivery, hosting, boundaries, and deferred decisions are explicit.
  - Verify: inspect `specs/001-foundation/spec.html` in a browser.
- [x] Task 2: Implement access and content contracts
  - Acceptance: four roles and a strict versioned manifest validate deterministically.
  - Verify: focused unit tests fail before implementation and pass afterward.
- [x] Task 3: Implement the staging preview slice
  - Acceptance: the same manifest renders at phone and tablet sizes.
  - Verify: unit/component tests and browser checks.
- [x] Task 4: Implement the separated Builder shell
  - Acceptance: planned panels are discoverable and release actions reflect capabilities.
  - Verify: accessibility and responsive browser checks.
- [x] Task 5: Establish quality and delivery automation
  - Acceptance: CI gates every push/PR; Pages is manual-only pending eligibility.
  - Verify: local full suite and workflow inspection.
- [x] Task 6: Create and verify the private GitHub repository
  - Acceptance: `PointCommunity/pointapp-builder` is private and exact `main` is pushed.
  - Verify: GitHub repository, commit, workflow, and Pages API readback.
