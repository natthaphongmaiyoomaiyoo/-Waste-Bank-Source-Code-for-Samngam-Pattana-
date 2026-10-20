// Business rule constants (backend/README.md "Business rules" section documents
// where each one is enforced).

// Every member keeps one savings balance (member_fund_balance.total_contribution)
// and it must reach at least this much: sales top it up to here first, and a
// balance under it fails funeral eligibility. The same amount is collected from
// each active member per death event. Savings can never be withdrawn.
export const FUND_MINIMUM_BAHT = 50;
// Funeral eligibility: member must have sold waste in at least this many
// distinct calendar months. Consecutiveness is NOT required (the months can be
// scattered), so there is no separate "continuous months" requirement.
export const ELIGIBILITY_MONTHS_REQUIRED = 6;
// The active-month count above is measured inside a rolling window of this
// many calendar months (current month + the previous N-1). Sales older than
// the window no longer count toward eligibility.
export const ELIGIBILITY_WINDOW_MONTHS = 12;
// Funeral eligibility: member must have been approved (a member) for at least
// this many whole months, measured from approvedDate.
export const MEMBERSHIP_TENURE_MONTHS_REQUIRED = 6;
// The usual age range for new members - guidance only, shown next to the age
// check. Nothing is refused on age: the system just works the age out and the
// committee certifies it, in range or not (committeeService.recordVerification).
export const MEMBER_MIN_AGE = 2;
export const MEMBER_MAX_AGE = 70;
export const SELL_REQUEST_ADVANCE_DAYS = 7;

function numberEnv(name: string, fallback: number): number {
  const value = Number(process.env[name]);
  return Number.isFinite(value) ? value : fallback;
}

function wasteTypeFactorsEnv(): Record<string, number> {
  const raw = process.env.CO2_CREDIT_WASTE_TYPE_FACTORS_JSON;
  if (!raw) return {};

  try {
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    return Object.fromEntries(
      Object.entries(parsed)
        .map(
          ([key, value]) => [key.trim().toLowerCase(), Number(value)] as const,
        )
        .filter(([, value]) => Number.isFinite(value)),
    );
  } catch {
    return {};
  }
}

export const CO2_CREDIT_DEFAULT_FACTOR_KG_CO2E_PER_KG = numberEnv(
  "CO2_CREDIT_DEFAULT_FACTOR",
  0.7,
);
export const CO2_CREDIT_WASTE_TYPE_FACTORS = wasteTypeFactorsEnv();

export const MEMBER_STATUS = {
  PENDING: "pending",
  ACTIVE: "active",
  RESIGNED: "resigned",
  DECEASED: "deceased",
} as const;

// Extra member-list filter that is NOT a member.status: it selects members
// whose savings balance is still under FUND_MINIMUM_BAHT, so the
// committee/municipality can chase them. Both member lists accept it as the
// `fundStatus` query param.
export const MEMBER_FUND_FILTER = {
  BELOW_MINIMUM: "below_minimum",
} as const;

export const COLLECTION_ROUND_STATUS = {
  PLANNED: "planned",
  COMPLETED: "completed",
  CANCELLED: "cancelled",
} as const;

export const SALE_REQUEST_STATUS = {
  REQUESTED: "requested",
  CONFIRMED: "confirmed",
  CANCELLED: "cancelled",
  COMPLETED: "completed",
} as const;

export const FUND_TRANSACTION_TYPE = {
  // Sale money automatically kept to bring savings up to FUND_MINIMUM_BAHT.
  CONTRIBUTION: "contribution",
  // Funeral collection: taken out of a member's savings for a death event.
  BENEFIT_PAYMENT: "benefit_payment",
  DONATION: "donation",
  ADJUSTMENT: "adjustment",
  // Sale money above the minimum that the member chose to keep in savings.
  DEPOSIT: "deposit",
  // Cash a member hands the municipality later to pay off a funeral
  // contribution they were short on. It passes straight on to that death's
  // family, so it is always followed by a benefit_payment of the same amount.
  FUNERAL_LATE_PAYMENT: "funeral_late_payment",
} as const;

// funeral_case.status - a committee's death report waits for the municipality;
// only approval marks the member deceased and moves any money.
export const FUNERAL_CASE_STATUS = {
  PENDING: "pending",
  APPROVED: "approved",
} as const;

// funeral_contribution.status - one paying member's contribution outcome for
// one funeral_case (death event).
export const FUNERAL_CONTRIBUTION_STATUS = {
  COMPLETED: "completed",
  PARTIALLY_PAID: "partially_paid",
  SHORTFALL_REMAINING: "shortfall_remaining",
} as const;

// Committee membership-application screening (member_verification.result).
export const VERIFICATION_RESULT = {
  PASSED: "passed",
  FAILED: "failed",
} as const;

// pickup_route_plan.status - a plan the committee confirmed and handed to the
// buyer. 'sent' until the buyer touches a stop, 'completed' once none are left
// pending.
export const ROUTE_PLAN_STATUS = {
  SENT: "sent",
  IN_PROGRESS: "in_progress",
  COMPLETED: "completed",
  CANCELLED: "cancelled",
} as const;

// pickup_route_stop.status - at most one 'next' per plan (the stop the buyer is
// currently driving to); see routePlanService.markStop.
export const ROUTE_STOP_STATUS = {
  PENDING: "pending",
  NEXT: "next",
  COLLECTED: "collected",
  SKIPPED: "skipped",
} as const;

// waste_type.status - 'pending' rows are buyer proposals awaiting an admin
// decision and are hidden from members/committees until approved.
export const WASTE_TYPE_STATUS = {
  ACTIVE: "active",
  PENDING: "pending",
  REJECTED: "rejected",
  INACTIVE: "inactive",
} as const;

export const USER_ACCOUNT_STATUS = {
  ACTIVE: "active",
  INACTIVE: "inactive",
} as const;
