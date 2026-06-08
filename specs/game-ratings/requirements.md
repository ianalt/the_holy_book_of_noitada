# Feature: Game Ratings   (WORKED EXAMPLE — delete when starting your own project)

## Outcome
Authenticated members can rate (1-5) registered games; the average is visible on the
game page.

## In scope
- One rating per user per game (editable).
- Average computed on read.

## Out of scope
- Comments, moderation, anonymous ratings.

## Acceptance criteria
- [ ] AC1: an authenticated member submits score 1-5 -> the rating is persisted.
- [ ] AC2: a score outside 1-5 -> 422.
- [ ] AC3: the same user resubmitting updates the existing rating (no duplicate).

## Security constraints
- Endpoint requires an authenticated member (OAuth session).
