/**
 * Shared Zod schemas for HomeOps (web + mobile).
 *
 * Enums and constants are imported from `@homeops/core` so the validation layer
 * never drifts from the domain model.
 */
import { z } from "zod";
import { ROLES } from "@homeops/core";
import type { Role } from "@homeops/core";

/* ------------------------------------------------------------------ */
/* Shared primitives                                                   */
/* ------------------------------------------------------------------ */

/** ISO-4217 currency code: 3 uppercase letters. */
export const currencySchema = z
  .string()
  .regex(/^[A-Z]{3}$/, "Must be a 3-letter ISO-4217 currency code");

/** Integer amount in minor units, within the safe-integer range. */
export const moneyMinorSchema = z
  .number()
  .int("Amount must be an integer number of minor units")
  .safe("Amount is out of safe integer range");

// NOTE: human-readable messages are intentionally omitted on user-facing fields so each
// client localizes them via a Zod errorMap keyed on the issue code (no English leaking
// into the UI; the web app maps codes → i18n). Logic-only messages are kept elsewhere.

/** Strict email. */
export const emailSchema = z.string().trim().toLowerCase().email();

/** Password with a minimum strength (length ≥ 8). */
export const passwordSchema = z.string().min(8);

/** YYYY-MM-DD calendar date. */
export const isoDateSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Must be an ISO date (YYYY-MM-DD)");

/** Non-empty trimmed string with a max length. */
const shortText = (max = 200) => z.string().trim().min(1).max(max);

/** Role enum derived from the core ROLES list (kept in sync, no drift). */
export const roleSchema = z.enum(ROLES as [Role, ...Role[]]);

const billingCycleSchema = z.enum(["MONTHLY", "QUARTERLY", "YEARLY", "WEEKLY", "ONE_TIME"]);

/* ------------------------------------------------------------------ */
/* Auth                                                                */
/* ------------------------------------------------------------------ */

export const loginSchema = z.object({
  email: emailSchema,
  password: z.string().min(1),
});

export const registerSchema = z.object({
  email: emailSchema,
  password: passwordSchema,
  displayName: shortText(120),
});

export const activateSchema = z.object({
  token: z.string().min(1),
});

/* ------------------------------------------------------------------ */
/* Two-factor authentication (TOTP)                                    */
/* ------------------------------------------------------------------ */

/** A 6-digit TOTP code. */
export const totpCodeSchema = z.string().trim().regex(/^\d{6}$/);

/** A formatted backup code, e.g. "a3kf-9p2m-7xqd" (dashes optional). */
export const recoveryCodeSchema = z
  .string()
  .trim()
  .toLowerCase()
  .regex(/^[a-z0-9]{4}-?[a-z0-9]{4}-?[a-z0-9]{4}$/);

/** Login step 2: either a 6-digit TOTP code or a backup code. */
export const totpChallengeSchema = z.object({
  code: z.union([totpCodeSchema, recoveryCodeSchema]),
});

/** Enrollment confirmation accepts only a 6-digit code. */
export const totpConfirmSchema = z.object({
  code: totpCodeSchema,
});

/** Password step-up for disable / recovery-code regeneration. */
export const totpDisableSchema = z.object({
  password: z.string().min(1),
});

/* ------------------------------------------------------------------ */
/* Household & membership                                              */
/* ------------------------------------------------------------------ */

export const householdSchema = z.object({
  name: shortText(120),
  default_currency: currencySchema,
});

export const inviteSchema = z.object({
  email: emailSchema,
  role: roleSchema,
});

/* ------------------------------------------------------------------ */
/* Obligations                                                         */
/* ------------------------------------------------------------------ */

export const obligationSchema = z.object({
  title: shortText(200),
  category: shortText(80),
  due_date: isoDateSchema,
  rrule: z.string().min(1).optional(),
  assignee_membership_id: z.string().uuid().optional(),
  estimated_amount_minor: moneyMinorSchema.optional(),
  currency: currencySchema.optional(),
  lead_time_days: z.number().int().min(0).max(365).default(0),
});

/* ------------------------------------------------------------------ */
/* Expenses                                                            */
/* ------------------------------------------------------------------ */

export const expenseSchema = z.object({
  amount_minor: moneyMinorSchema,
  currency: currencySchema,
  occurred_on: isoDateSchema,
  category: shortText(80),
  service_id: z.string().uuid().optional(),
});

/* ------------------------------------------------------------------ */
/* Services (subscriptions / contracts)                               */
/* ------------------------------------------------------------------ */

export const serviceSchema = z.object({
  provider_name: shortText(160),
  fee_amount_minor: moneyMinorSchema,
  currency: currencySchema,
  billing_cycle: billingCycleSchema,
  contract_end: isoDateSchema.optional(),
  cancellation_deadline: isoDateSchema.optional(),
});

/* ------------------------------------------------------------------ */
/* Inferred types                                                      */
/* ------------------------------------------------------------------ */

export type LoginInput = z.infer<typeof loginSchema>;
export type RegisterInput = z.infer<typeof registerSchema>;
export type ActivateInput = z.infer<typeof activateSchema>;
export type TotpChallengeInput = z.infer<typeof totpChallengeSchema>;
export type TotpConfirmInput = z.infer<typeof totpConfirmSchema>;
export type TotpDisableInput = z.infer<typeof totpDisableSchema>;
export type HouseholdInput = z.infer<typeof householdSchema>;
export type InviteInput = z.infer<typeof inviteSchema>;
export type ObligationInput = z.infer<typeof obligationSchema>;
export type ExpenseInput = z.infer<typeof expenseSchema>;
export type ServiceInput = z.infer<typeof serviceSchema>;
export type BillingCycle = z.infer<typeof billingCycleSchema>;
