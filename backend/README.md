# Waste Bank Backend (Member + Municipality + Committee roles)

Backend for "ระบบธนาคารขยะรีไซเคิลเพื่อสนับสนุนกองทุนฌาปนกิจสงเคราะห์ชุมชนตำบลสามง่ามพัฒนา", built from
the project's ER diagram and requirements document. **This pass implements the Member role**, plus
real Admin *login*, a standalone News module (see "News module" below), the **Municipality
Officer role** (read-only monitoring/reporting for the supervising municipality - see "Municipality
role" below), and the **Waste Bank Committee role** (member management: register walk-in
applicants, screen eligibility, approve/suspend/cancel - see "Committee role" below), each added
in later passes.
The Buyer role currently covers its waste-type price list (propose a type + price, admin approves
before members see it - see "Buyer role" below) and the pickup route plans the committee hands over
(see "Pickup route plans"); the buying counter itself and the rest
of an Admin back office (beyond news and
authentication) are intentionally not built yet, but the layered structure
(`config / database / middleware / validators / services / controllers / routes`) is meant to let
those be added without reshaping what's here.

Stack: **Node.js + TypeScript + Express + Prisma + PostgreSQL**, **zod** for validation, **JWT** +
**bcryptjs** for auth, and **Supabase Storage** for persistent uploads. Local development may use
the gitignored `uploads/` fallback; production fails fast unless Supabase Storage is configured.

## Setup

```bash
cd backend
npm install
cp .env.example .env        # set PostgreSQL URLs and a strong JWT secret
npx prisma migrate deploy   # applies committed PostgreSQL migrations
npx prisma db seed          # loads sample data (see "Seed data" below)
npm run dev                 # starts the API on http://localhost:4000
```

Other useful scripts: `npm run typecheck`, `npm run build && npm start` (compiled), and
`npm run prisma:studio` (browse PostgreSQL data visually).

## Team Git Workflow

- Never commit `.env`, database passwords, JWT secrets, or the Supabase service-role key.
- Share schema changes through `prisma/schema.prisma` and PostgreSQL-only `prisma/migrations/`.
- Historical SQLite migrations are archived in `prisma/migrations-sqlite/` and must not be deployed.

```bash
cd backend
npx prisma migrate deploy
npx prisma db seed
```

Use a separate PostgreSQL database/schema through `TEST_DATABASE_URL` for tests. The test suite
requires both effective test connections to explicitly include `schema=wastebank_test` and refuses
to run against `DATABASE_URL`/`DIRECT_URL` because its fixtures delete rows. Tests also force
`SUPABASE_STORAGE_REMOTE=false` and use an automatically cleaned temporary upload directory, so
fixtures never reach Supabase Storage. `TEST_DIRECT_URL` is optional only when
`TEST_DATABASE_URL` itself is suitable for migrations; otherwise configure both.

## Render deployment

- Build command: `npm ci && npm run prisma:generate && npm run build`
- Start command: `npx prisma migrate deploy && npm start`
- Health check: `/health`
- Required environment: `DATABASE_URL`, `DIRECT_URL`, `JWT_SECRET`, `NODE_ENV=production`, `PORT`,
  `CORS_ORIGIN`, `PUBLIC_BASE_URL`, `SUPABASE_STORAGE_REMOTE=true`, `SUPABASE_URL`,
  `SUPABASE_SERVICE_ROLE_KEY`, and all `SUPABASE_STORAGE_BUCKET_*` values from `.env.example`.
- `CORS_ORIGIN` accepts a comma-separated allowlist; set it to the Vercel production/preview origins
  that should call this API. Set frontend `VITE_API_URL` to the Render URL ending in `/api`.

The web backup/restore endpoints intentionally return HTTP 501 on PostgreSQL. Use Supabase managed
backup/restore tooling; never upload a database file through this API.

## Seed data / trying it out

The seed creates one **active** sample member you can log in as immediately:

- identifier: `1100000000001` (citizen ID) or `081-234-5678` (phone)
- password: `Member123!`

...and one **admin** account (memberless - see "Admin login" below):

- username: `admin`
- password: `Admin123!`

...and one **municipality officer** account (memberless, read-only monitoring - see "Municipality role" below):

- username: `municipality01`
- password: `Municipality123!`

...and one **committee** account (memberless, member management - see "Committee role" below):

- username: `committee01`
- password: `Committee123!`

...and one **buyer** account:

- username: `buyer01`
- password: `Buyer123!`

...and one **pending walk-in applicant** (member `1100000000002`, initial password = citizen ID) so
the committee's screen-then-approve flow can be exercised right after seeding.

Seeded demo accounts use initial passwords and return `mustChangePassword: true` at login. The
backend allows `/auth/me` and `/auth/password` while the flag is set, but blocks other authenticated
API routes until the password is changed.

It also seeds: 5 roles, 2 households, 6 waste types, 1 buyer, 1 fund account, 3 upcoming collection
rounds (two `planned` you can pick for a new sell request, one `cancelled` to see the "closed round"
case), 4 past completed rounds backing 4 months of the sample member's sale/receipt/fund-contribution
history (fund balance lands exactly at the 50-baht minimum), one already-open sell request, one
notification, and starter news posts using external placeholder images. Re-running the seed skips
news rows with the same title and posting date.

```bash
# Register a new member
curl -X POST http://localhost:4000/api/auth/register -H "Content-Type: application/json" -d '{
  "citizenId": "1234567890123", "password": "Password123!",
  "firstName": "ทดสอบ", "lastName": "ระบบ", "birthDate": "1995-01-01",
  "phone": "0899999999", "address": { "moo": "1", "subdistrict": "สามง่ามพัฒนา" }
}'

# Log in as the seeded sample member
curl -X POST http://localhost:4000/api/auth/login -H "Content-Type: application/json" -d '{
  "identifier": "1100000000001", "password": "Member123!"
}'
# -> { "token": "...", "user": { "roleName": "member", ... }, "member": { ... } }

curl http://localhost:4000/api/member/profile -H "Authorization: Bearer <token>"

# Log in as admin (memberless account - "member" is null)
curl -X POST http://localhost:4000/api/auth/login -H "Content-Type: application/json" -d '{
  "identifier": "admin", "password": "Admin123!"
}'
# -> { "token": "...", "user": { "roleName": "admin", ... }, "member": null }

# Create a news post (multipart/form-data, admin only)
curl -X POST http://localhost:4000/api/news -H "Authorization: Bearer <admin token>" \
  -F "title=หัวข้อข่าว" -F "details=รายละเอียดข่าว" -F "postedAt=2026-07-09T00:00:00.000Z" \
  -F "image=@/path/to/image.jpg"
```

## API routes (all under `/api`, `Authorization: Bearer <token>` required unless noted)

| Method | Path | Notes |
|---|---|---|
| POST | `/auth/register` | public. Creates household + member (`status=pending`) + user account. |
| POST | `/auth/login` | public. `{ identifier, password }`, identifier = citizen ID or phone. Records `last_login`, login audit, failed-login count, and account lockout. |
| GET | `/auth/me` | validates the bearer token and returns the current user/member session. |
| POST | `/auth/forgot-password` | public. Records a password reset request after matching identifier + phone; dev mode returns a reset token for local testing. |
| POST | `/auth/reset-password` | public. Resets the password with a valid reset token. |
| PATCH | `/auth/password` | change password (`currentPassword`, `newPassword`); clears `must_change_password`, lockout, and reset token fields. |
| GET | `/member/profile` | profile incl. household, guarantors, account status. |
| PATCH | `/member/profile` | update editable fields (+ nested `address`). |
| GET | `/schedule` | upcoming collection rounds (any status shown, so a member can see *why* a round is closed). |
| POST | `/sell-requests` | create a sell request; `roundId` must be an open (`planned`, future) round - see "Business rules". |
| GET | `/sell-requests` | the member's own sell requests. |
| PATCH | `/sell-requests/:id/cancel` | cancel while still `requested`/`confirmed`. |
| GET | `/history/sales` | completed sales + line items + receipt. |
| GET | `/history/sales/:id` | one sale in detail. |
| GET | `/fund/balance` | current `member_fund_balance`. |
| GET | `/fund/transactions` | fund contribution/deduction history. |
| GET | `/eligibility` | computes + records a fresh `eligibility_check` (months participated, is_eligible, unmet reasons). |
| GET | `/notifications` | the logged-in user's notifications. |
| PATCH | `/notifications/:id/read` | mark one as read. |
| GET | `/news` | public, no auth. List of news posts, newest `postedAt` first. |
| GET | `/news/:id` | public, no auth. One news post. |
| POST | `/news` | **admin only**. `multipart/form-data`: `title`, `details`, `postedAt`, `image` (file, required, jpeg/png/webp/gif, ≤2MB). |
| PUT | `/news/:id` | **admin only**. Same fields, all optional; `image` only if replacing the picture. |
| DELETE | `/news/:id` | **admin only**. Also deletes the object from configured storage. |
| GET | `/municipality/members` | **municipality only** (like all `/municipality/*`). Paginated member list. Query: `page`, `pageSize` (≤100), `search` (name/citizen ID/phone/member code), `status`, `moo`, `subdistrict`. |
| GET | `/municipality/members/summary` | member totals: overall, by status, new this month, household count. |
| GET | `/municipality/members/:id` | one member in full: profile, household, guarantors, account status, fund balance, participation stats, recent sales/fund transactions, latest eligibility check. |
| GET | `/municipality/operations/summary` | sale statistics: completed count, total/net/fund-deduct amounts, quantity, participants, per-waste-type breakdown, monthly series, 5 recent sales. Query: `dateFrom`, `dateTo`, `month` (needs `year`), `year`, `memberId`, `wasteTypeId`, `roundId`. |
| GET | `/municipality/operations/sales` | paginated completed-sale list; same filters as the summary plus `page`/`pageSize`. |
| GET | `/municipality/fund/summary` | fund accounts + total balance, totals in/out, per-transaction-type breakdown, welfare payouts so far, 10 recent transactions. |
| GET | `/municipality/fund/transactions` | paginated fund ledger. Query: `page`, `pageSize`, `transactionType`, `memberId`, `dateFrom`, `dateTo`. |
| GET | `/municipality/reports/monthly` | structured JSON report for one month (`year`, `month` required): members, operations, fund, and deltas vs. the previous month. |
| GET | `/municipality/reports/yearly` | structured JSON report for one year (`year` required): same sections plus a 12-row month-by-month breakdown. |
| GET | `/municipality/reports/executive` | snapshot report: member/fund/operation KPIs, 6-month trend, top waste types. |
| GET | `/committee/members` | **committee only** (like all `/committee/*`). Paginated member list. Query: `page`, `pageSize` (≤100), `search` (name/citizen ID/phone/member code), `status`, `moo`. Rows include the latest `member_verification`. |
| GET | `/committee/members/summary` | member totals: overall, by status, new this month. |
| GET | `/committee/members/:id` | one member in full: profile, household, guarantors, account, fund balance, all verifications, plus `currentAge` and the age rule. |
| POST | `/committee/members` | register a walk-in applicant (`status=pending`): same shape as `/auth/register` but `password` is optional (defaults to the citizen ID). |
| PATCH | `/committee/members/:id` | edit member fields (+ nested `address`, `guarantor` - replaces/creates the primary guarantor); keeps the login account's name/phone in sync. |
| POST | `/committee/members/:id/verification` | record an eligibility screening (`addressVerified`, `guarantorVerified`, `result`, `note`). Age is computed server-side; `result="passed"` requires all three checks to pass. Pending applicants only. |
| PATCH | `/committee/members/:id/approve` | pending → active (sets `approved_date`). Requires the latest verification to be `passed`. |
| PATCH | `/committee/members/:id/suspend` | active → suspended (optional `note` → `remark`); also disables the member's login account. |
| PATCH | `/committee/members/:id/reactivate` | suspended → active; re-enables the login account. |
| PATCH | `/committee/members/:id/cancel` | pending/active/suspended → resigned (optional `note`); also disables the login account. |
| PATCH | `/committee/members/:id/deceased` | pending/active/suspended → deceased (optional `note`); disables the member's login account and, in one transaction, collects a 50-baht funeral contribution from every other active member's savings (whatever they have, up to 50 - see below). |

## Business rules enforced

- Citizen ID is unique (`member.citizen_id` unique constraint; registration returns 409 on duplicate).
- Age must be 18–70 at registration (`authService.register`, checked against `birthDate`).
- Only a member with `status = 'active'` can create a sell request (`sellRequestService.create`).
- A sell request's `roundId` must point at a `planned`, non-past `collection_round` — members cannot
  pick an arbitrary date, mirroring the same rule already enforced in the frontend's `SellRequestPage.vue`.
- Fund minimum (50 baht) and the sale-activity eligibility rule are centralized in `config/constants.ts` and
  computed live in `eligibilityService.checkEligibility` / `fundService`, not hardcoded per-endpoint.
- Each member has exactly one savings balance (ยอดเงินสะสม), `member_fund_balance.total_contribution`,
  and it can never be withdrawn. Recording a purchase (`committeeSellRequestService.recordPurchase`)
  first tops it up to 50 baht out of the sale (`contribution` transaction); of what is left, the
  committee enters `depositAmount` - how much the member keeps in savings (`deposit` transaction) -
  and the rest is paid in cash. Money only leaves savings through funeral collections.
- A deceased member must pass funeral eligibility before any automatic collection happens:
  `member_fund_balance.total_contribution >= 50`, approved as a member for at least 6 months, and
  completed waste sales in at least 6 distinct months within the last 12 calendar months (the months
  need not be consecutive). If they pass, marking them `deceased` creates one
  `funeral_case` row (the death event) and, for every other `active` member, collects the required
  50 baht via `funeralFundService.collectFuneralContribution`
  (`backend/src/services/funeralFundService.ts`):
  1. up to 50 baht is taken from the payer's savings (`member_fund_balance.total_contribution`) -
     everything they have if it's less;
  2. a `funeral_contribution` row is written per payer (unique on `funeral_case_id` + `member_id`, so a
     payer can never be charged twice for the same case) recording the amount paid, any remaining
     shortfall, and a status of `completed` / `partially_paid` / `shortfall_remaining`;
  3. a `benefit_payment` `fund_transaction` referencing `funeral_case_id` is written for the amount paid;
  4. the central fund balance is updated by the sum actually collected, paying members are notified, and
     any payer left with a shortfall gets an additional notification stating the remaining amount.

  A payer with empty savings doesn't block the whole death event - they're simply left with
  a `shortfall_remaining` contribution and a notification, while every other payer is still charged. This
  still all runs inside one Prisma transaction, so a genuine error (e.g. the deceased member themselves
  is missing or ineligible) rolls back every write with no partial balances.
- An applicant can only be **approved** after the latest `member_verification` for them has
  `result = 'passed'`, and `'passed'` itself requires the age check (server-computed from the stored
  birth date, 18–70) plus the committee's address and guarantor confirmations
  (`committeeService.recordVerification` / `approveMember`).
- Suspending or cancelling a member flips the linked `user_account` to `inactive`, and
  `authService.login` rejects inactive accounts - so a suspended/cancelled member really cannot
  log in until reactivated.

## Assumptions / scope decisions (ERD vs. prose conflicts)

The instructions were to follow the ERD structurally when it conflicts with the prose requirements,
then align field *behavior* with the prose. Two places that came up:

1. **Sell request waste-type breakdown.** The prose says a member should specify waste type(s) when
   requesting a sale, but the ERD's `sale_request` table (unlike the completed `waste_sale`, which has
   a `waste_sale_detail` child table) has only one `estimated_quantity` field and no waste-type link.
   Rather than adding a table not in the ERD, `POST /sell-requests` accepts a client-side array of
   `{ wasteTypeId, estimatedQuantity }`, sums it into `estimated_quantity`, and writes a human-readable
   breakdown into `note` (e.g. "ขวดพลาสติก 15 kg, กระดาษลัง 8 kg"). This mirrors what the frontend's
   `SellRequestPage.vue` already does client-side (joins per-item quantities into one string).
2. **`collection_round.status`.** The ERD documents exactly three values (`planned`, `completed`,
   `cancelled`). An earlier frontend-only pass (this repo's `frontend/src/stores/scheduleStore.ts`) had
   introduced a fourth `full` status not in this ERD. Per the ERD-first instruction, this backend does
   **not** add a `full` status — a "closed" round here means `cancelled`, not "at capacity" (there's no
   capacity field on `collection_round` in the ERD to model that with).

### Tables intentionally excluded this pass

- `funeral_claim`, `funeral_payment` — filed by a deceased member's relatives, not member self-service;
  none of the 8 requested Member-role scope areas touch funeral claims.
- `member_status_history` — a committee audit trail. The Member role only needs to *read*
  `member.status` (exposed via `GET /member/profile`), not the change log.

### Other simplifications, documented here rather than silently

- Money/quantity fields (`default_price`, `total_amount`, `estimated_quantity`, etc.) are stored as
  `Float`, not `Decimal` — simpler to serialize directly to JSON; fine at this scale, but a real
  production system moving real money should switch to `Decimal` + fixed rounding rules.
- Audit "who did this" columns (`collection_round.created_by`, `waste_sale.recorded_by`,
  `receipt.issued_by`, `fund_transaction.recorded_by`, `eligibility_check.checked_by`) are stored as
  plain nullable integer columns, not full Prisma relations — they reference `user_account.user_id`
  conceptually (per the ERD), but since the Committee/Admin side that owns those accounts isn't built
  yet, wiring real FK relations for five separate "creator" links would be schema noise with no
  functional payoff in this pass.
- `user_account.member_id` is modeled as `@unique` (one login per member) — the ERD marks it
  `FK / NULL`, which this respects (non-member accounts, e.g. committee/admin, simply leave it null),
  but doesn't say members and accounts are 1:1; a citizen only having one login account is the obviously
  intended reading of the registration/login flow in the prose.
- `GET /schedule` returns rounds regardless of status (not just `planned`) so a member can see *why* a
  nearby round is unavailable (`cancelled`), matching the frontend's existing schedule-page UX rather
  than just silently omitting it.

### News module and Admin login (not in the ERD)

The 20-table ERD has no "news/announcements" table and no Admin-role tables beyond `role` and
`user_account` itself (which already supports arbitrary roles). Two additions were made on top of the
ERD to support the frontend's homepage news feature and its admin management page:

- **`news` table** - a plain, non-ERD model (`id`, `title`, `details`, `image_url`, `posted_at`,
  `created_at`, `updated_at`). `image_url` stores an object path; `newsService.ts` resolves its public
  Supabase URL when returning API data.
- **Real Admin login.** `authService.login()` previously *required* a linked `member` row to succeed,
  meaning only Member-role accounts could ever authenticate - there was no way for an Admin account to
  log in at all. It now only requires a `member` row when `role.roleName === 'member'`; `AuthTokenPayload
  .memberId` is `number | null` accordingly. Every route that assumes a member (`/member`,
  `/sell-requests`, `/history`, `/fund`, `/eligibility`) now also runs `requireRole('member')` right
  after `requireAuth`, both to make that `memberId` non-null assumption actually safe at runtime (not
  just a type-level assertion) and because, before this change, *any* authenticated JWT regardless of
  role could hit those member-only endpoints - a real gap this closes as a side effect.

Uploaded images are validated (jpeg/png/webp/gif, ≤2MB) in memory and stored with generated,
collision-safe object names. News, avatars, and videos use public URLs; member and sale documents
use short-lived signed URLs from private buckets.

### Funeral fund tables (not in the ERD)

`funeral_case` and `funeral_contribution` are plain, non-ERD additions backing the collection-side
logic described above under "Business rules enforced" - they are not the ERD's `funeral_claim` /
`funeral_payment` (still excluded; those are the payout-to-relatives side). `funeral_case` is one row
per death event; `funeral_contribution` is one row per paying member per case, unique on
(`funeral_case_id`, `member_id`) so a repeat call for the same pair is a no-op instead of a double
deduction. See `backend/src/services/funeralFundService.ts`.

### Municipality role (read-only monitoring/reporting)

The municipality is the project's supervising organization. A Municipality Officer logs in with a
normal (memberless) `user_account` whose role is `municipality` and gets a **read-only** view of the
system: member records, waste-sale performance, the community fund, and monthly/yearly/executive
reports. Design decisions:

- **GET-only surface.** Every `/api/municipality/*` route is a GET; `municipalityService.ts` never
  writes. Municipality accounts cannot modify member, sale, fund, or admin data - the routes for
  those mutations require the `member`/`admin` roles they already required.
- **`requireRole('municipality')` on the whole route group** (`src/routes/municipalityRoutes.ts`),
  mirroring how `/member`, `/fund`, etc. lock themselves to `member`. Admin tokens get 403 here just
  like municipality tokens get 403 on member routes - each role keeps its own surface.
- **Query validation** lives in `src/validators/municipalityValidators.ts` (zod, `z.coerce` for
  querystring numbers): pagination is capped at 100 rows, `month` requires `year`, `dateFrom` must
  not be after `dateTo`, and an explicit `dateFrom`/`dateTo` range wins over `month`/`year` when both
  are sent.
- **Welfare/funeral payouts.** The ERD's `funeral_claim` / `funeral_payment` tables are still
  intentionally excluded (see "Tables intentionally excluded"), so payout monitoring is exposed
  through `fund_transaction` rows with `transaction_type = 'benefit_payment'` (surfaced as
  `welfarePayments` in `/municipality/fund/summary` and filterable in `/municipality/fund/transactions`).
  When the funeral tables are added later, a `/municipality/welfare/*` route group can be added
  alongside without breaking any existing endpoint.
- **Historical fund balances** in reports use `fund_transaction.balance_after` of the last
  transaction on or before the period end, so a monthly report shows the balance *as of that month*,
  not today's.

### Committee role (member management)

The Waste Bank / Village Committee registers walk-in applicants at the desk and manages the member
lifecycle. A committee user logs in with a memberless `user_account` whose role is `committee`
(seeded: `committee01`). Design decisions:

- **The workflow is register → screen → approve.** `POST /committee/members` creates the applicant
  as `status = 'pending'` (household + optional guarantor + login account, exactly like public
  registration, but the initial password defaults to the citizen ID when omitted).
  `POST /committee/members/:id/verification` records the eligibility screening in the new
  `member_verification` table - age (server-computed, 18–70), address confirmed, guarantor
  confirmed, an overall `result`, and a note; `verified_by` stores the committee user's id.
  `PATCH /committee/members/:id/approve` then refuses unless the latest screening `passed`.
- **`member_verification` is a new, committee-specific table** (see `prisma/schema.prisma`). It is
  deliberately separate from `eligibility_check`, which records the *fund/funeral-benefit*
  eligibility computed from selling history - two different business questions.
- **Lifecycle actions** (`suspend` / `reactivate` / `cancel`) are explicit endpoints with status
  guards (only active members can be suspended, only suspended ones reactivated, etc.), and they
  keep the member's login account status in sync so suspension actually locks the account.
- **Member status history** is stored in `member_status_history`. Public registration and committee
  walk-in registration write the initial `pending` row, and every approve/suspend/reactivate/cancel/
  deceased transition records `from_status`, `to_status`, optional reason, actor id, and timestamp.
  Committee member detail includes `statusHistories` newest-first so the UI can show an audit trail.
- **`requireRole('committee')` on the whole route group** (`src/routes/committeeRoutes.ts`) - the
  requirement explicitly says other roles must not see or use this feature, so even admin tokens
  get 403 here, mirroring how the other role groups are locked.

### Buyer role (waste-type price list, admin-approved)

The buyer (ผู้รับซื้อขยะ) is the shop that actually pays for the collected waste, so it is the role
that knows what is worth buying and at what price. A buyer user logs in with a memberless
`user_account` whose role is `buyer` (seeded: `buyer01`). Design decisions:

- **Buyers propose, admins publish.** `POST /waste-types/proposals` creates the row immediately but
  with `status = 'pending'`, so it is not a separate proposal table to reconcile later - it *is* the
  waste type, just not a published one. Every consumer of the catalog goes through
  `wasteTypeService.listActive()`, which filters on `status = 'active'`, so a pending row is
  invisible to members and committees without any extra check at each call site.
- **No price history until approval.** `waste_price_history` gets its opening row when the admin
  approves (same as an admin-created type), so a suggested price never leaks into price reporting.
  The admin may correct the suggested name/unit/price while approving.
- **A rejection is kept, not deleted.** `status = 'rejected'` plus `reject_reason` stays visible to
  the proposing buyer via `GET /waste-types/proposals/mine`, so they can see why and re-submit a
  corrected version (the duplicate guard only blocks names that are currently `active`/`pending`).
- **Both sides get a notification** (`notification_type = 'waste_type'`): admins when a proposal
  arrives, the proposing buyer when it is approved or rejected.

| Method | Path | Notes |
|---|---|---|
| GET | `/waste-types` | admin / committee / member / buyer. Active types only. |
| POST | `/waste-types/proposals` | **buyer only**. `{ wasteName, unit, defaultPrice }` → `status='pending'`. 409 if the name is already active or pending. |
| GET | `/waste-types/proposals/mine` | **buyer only**. Everything this buyer proposed, any status, with `rejectReason`. |
| GET | `/waste-types/proposals` | **admin only**. Review queue. Query `status` = `pending` (default) / `active` / `rejected` / `inactive` / `all`; each row carries `proposer`. |
| POST | `/waste-types/proposals/:id/approve` | **admin only**. Optional `{ wasteName, unit, defaultPrice }` overrides. Flips to `active` + writes price history. |
| POST | `/waste-types/proposals/:id/reject` | **admin only**. `{ reason }` (required). |

### Pickup route plans (committee confirms → buyer drives)

The village committee already ordered the day's accepted sell requests on a map
(`CommitteeRoutePlanPage`); confirming that plan persists it and hands it to the buyer who will
actually drive it. Two new non-ERD tables, `pickup_route_plan` + `pickup_route_stop`. Design
decisions:

- **`user_account.buyer_id` binds a buyer login to its shop**, exactly the way `village_area_id`
  binds a committee login to its village, and `middleware/buyerScope.ts` mirrors
  `requireVillageScope`: a buyer only ever sees plans addressed to their own `buyer` row, and an
  unbound buyer account is refused outright rather than silently shown everything. The migration
  backfills existing buyer logins to the first `buyer` row so seeded accounts keep working.
- **Coordinates are copied onto the stop at confirm time.** The buyer drives the route the committee
  approved even if a member later moves their pin. Leg distances are recomputed server-side from
  those stored coordinates rather than trusted from the client, so the buyer's totals always match
  what is on the map.
- **Array order is the visit order.** `sequence` is assigned server-side from the submitted array, so
  a client cannot send a plan whose numbering disagrees with its own ordering.
- **One plan = one buyer.** Stops are rejected if their collection rounds point at different buyers -
  a mixed route is one no single shop can drive. Every stop must also be a `confirmed` sell request
  in the committee's own village.
- **`next` is exclusive.** A driver is heading to exactly one place at a time, so promoting a stop
  demotes whichever one held `next`. The member whose stop becomes `next` is notified that the truck
  is on its way - that is the point of the mark.
- **Plan status is derived, never set by hand**: `sent` until the buyer touches a stop,
  `in_progress` after, `completed` once no stop is left `pending`/`next`.

| Method | Path | Notes |
|---|---|---|
| POST | `/committee/route-plans` | **committee** (village-scoped). `{ stops: [{ requestId, lat, lng }], startLat?, startLng?, planDate?, note? }`. Notifies the buyer. |
| GET | `/committee/route-plans` | Plans this committee sent, with the progress the buyer reported. Query `status`. |
| GET | `/committee/route-plans/:id` | One plan; refuses another village's. |
| PATCH | `/committee/route-plans/:id/cancel` | Cancels and notifies the buyer. A completed plan cannot be cancelled. |
| GET | `/buyer/route-plans` | **buyer** (shop-scoped). Defaults to `sent` + `in_progress`; `status=all` for history. |
| GET | `/buyer/route-plans/:id` | One plan; refuses another shop's. |
| PATCH | `/buyer/route-plans/:id/stops/:stopId` | `{ status: 'pending' \| 'next' \| 'collected' \| 'skipped', note? }`. Returns the whole plan. |

## Frontend integration

The frontend (`frontend/`) calls this API directly for auth, member profile, schedule, sell requests,
history, fund, eligibility, notifications, and news (see `frontend/src/boot/axios.ts` for the API
client and `frontend/src/stores/*.ts` for the Pinia stores that wrap each of these). The Admin panel
beyond login and news management (e.g. managing waste types, collection schedules, or members) still
has no backend behind it and remains frontend-only for now.

The Municipality dashboard is fully wired: logging in as `municipality01` routes to `/municipality`
(guarded by the `municipality` role in `frontend/src/router/`), with read-only pages for member
monitoring (`/municipality/members`, `/municipality/members/:id`), operation performance
(`/municipality/operations`), fund monitoring (`/municipality/fund`), and monthly/yearly/executive
reports (`/municipality/reports`), all backed by `frontend/src/stores/municipalityStore.ts`.

The Committee area is fully wired too: logging in as `committee01` routes to `/committee/members`
(guarded by the `committee` role), with a member-management page (search, detail + eligibility
screening + approve, edit, suspend/reactivate/cancel) and the "เพิ่มสมาชิก" (Add Member) page
(`/committee/add-member`) for registering walk-in applicants, both backed by
`frontend/src/stores/committeeStore.ts`.
