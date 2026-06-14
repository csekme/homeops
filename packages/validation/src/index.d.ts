/**
 * Shared Zod schemas for HomeOps (web + mobile).
 *
 * Enums and constants are imported from `@homeops/core` so the validation layer
 * never drifts from the domain model.
 */
import { z } from "zod";
import type { Role } from "@homeops/core";
/** ISO-4217 currency code: 3 uppercase letters. */
export declare const currencySchema: z.ZodString;
/** Integer amount in minor units, within the safe-integer range. */
export declare const moneyMinorSchema: z.ZodNumber;
/** Strict email. */
export declare const emailSchema: z.ZodString;
/** Password with a minimum strength (length ≥ 8). */
export declare const passwordSchema: z.ZodString;
/** YYYY-MM-DD calendar date. */
export declare const isoDateSchema: z.ZodString;
/** Role enum derived from the core ROLES list (kept in sync, no drift). */
export declare const roleSchema: z.ZodEnum<[Role, ...Role[]]>;
declare const billingCycleSchema: z.ZodEnum<["MONTHLY", "QUARTERLY", "YEARLY", "WEEKLY", "ONE_TIME"]>;
export declare const loginSchema: z.ZodObject<{
    email: z.ZodString;
    password: z.ZodString;
}, "strip", z.ZodTypeAny, {
    email: string;
    password: string;
}, {
    email: string;
    password: string;
}>;
export declare const registerSchema: z.ZodObject<{
    email: z.ZodString;
    password: z.ZodString;
    displayName: z.ZodString;
}, "strip", z.ZodTypeAny, {
    email: string;
    password: string;
    displayName: string;
}, {
    email: string;
    password: string;
    displayName: string;
}>;
export declare const activateSchema: z.ZodObject<{
    token: z.ZodString;
}, "strip", z.ZodTypeAny, {
    token: string;
}, {
    token: string;
}>;
export declare const householdSchema: z.ZodObject<{
    name: z.ZodString;
    default_currency: z.ZodString;
}, "strip", z.ZodTypeAny, {
    name: string;
    default_currency: string;
}, {
    name: string;
    default_currency: string;
}>;
export declare const inviteSchema: z.ZodObject<{
    email: z.ZodString;
    role: z.ZodEnum<[Role, ...Role[]]>;
}, "strip", z.ZodTypeAny, {
    email: string;
    role: Role;
}, {
    email: string;
    role: Role;
}>;
export declare const obligationSchema: z.ZodObject<{
    title: z.ZodString;
    category: z.ZodString;
    due_date: z.ZodString;
    rrule: z.ZodOptional<z.ZodString>;
    assignee_membership_id: z.ZodOptional<z.ZodString>;
    estimated_amount_minor: z.ZodOptional<z.ZodNumber>;
    currency: z.ZodOptional<z.ZodString>;
    lead_time_days: z.ZodDefault<z.ZodNumber>;
}, "strip", z.ZodTypeAny, {
    title: string;
    category: string;
    due_date: string;
    rrule?: string | undefined;
    assignee_membership_id?: string | undefined;
    estimated_amount_minor?: number | undefined;
    currency?: string | undefined;
    lead_time_days: number;
}, {
    title: string;
    category: string;
    due_date: string;
    rrule?: string | undefined;
    assignee_membership_id?: string | undefined;
    estimated_amount_minor?: number | undefined;
    currency?: string | undefined;
    lead_time_days?: number | undefined;
}>;
export declare const expenseSchema: z.ZodObject<{
    amount_minor: z.ZodNumber;
    currency: z.ZodString;
    occurred_on: z.ZodString;
    category: z.ZodString;
    service_id: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    amount_minor: number;
    currency: string;
    occurred_on: string;
    category: string;
    service_id?: string | undefined;
}, {
    amount_minor: number;
    currency: string;
    occurred_on: string;
    category: string;
    service_id?: string | undefined;
}>;
export declare const serviceSchema: z.ZodObject<{
    provider_name: z.ZodString;
    fee_amount_minor: z.ZodNumber;
    currency: z.ZodString;
    billing_cycle: z.ZodEnum<["MONTHLY", "QUARTERLY", "YEARLY", "WEEKLY", "ONE_TIME"]>;
    contract_end: z.ZodOptional<z.ZodString>;
    cancellation_deadline: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    provider_name: string;
    fee_amount_minor: number;
    currency: string;
    billing_cycle: "MONTHLY" | "ONE_TIME" | "QUARTERLY" | "WEEKLY" | "YEARLY";
    contract_end?: string | undefined;
    cancellation_deadline?: string | undefined;
}, {
    provider_name: string;
    fee_amount_minor: number;
    currency: string;
    billing_cycle: "MONTHLY" | "ONE_TIME" | "QUARTERLY" | "WEEKLY" | "YEARLY";
    contract_end?: string | undefined;
    cancellation_deadline?: string | undefined;
}>;
export type LoginInput = z.infer<typeof loginSchema>;
export type RegisterInput = z.infer<typeof registerSchema>;
export type ActivateInput = z.infer<typeof activateSchema>;
export type HouseholdInput = z.infer<typeof householdSchema>;
export type InviteInput = z.infer<typeof inviteSchema>;
export type ObligationInput = z.infer<typeof obligationSchema>;
export type ExpenseInput = z.infer<typeof expenseSchema>;
export type ServiceInput = z.infer<typeof serviceSchema>;
export type BillingCycle = z.infer<typeof billingCycleSchema>;
export {};
