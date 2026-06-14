import { describe, it, expect } from "vitest";
import { loginSchema, registerSchema, activateSchema, householdSchema, inviteSchema, obligationSchema, expenseSchema, serviceSchema, currencySchema, moneyMinorSchema, } from "./index.js";
describe("shared primitives", () => {
    it("accepts a valid currency code", () => {
        expect(currencySchema.safeParse("EUR").success).toBe(true);
    });
    it("rejects an invalid currency code", () => {
        expect(currencySchema.safeParse("eur").success).toBe(false);
        expect(currencySchema.safeParse("EU").success).toBe(false);
        expect(currencySchema.safeParse("EURO").success).toBe(false);
    });
    it("rejects a float minor amount", () => {
        expect(moneyMinorSchema.safeParse(12.34).success).toBe(false);
        expect(moneyMinorSchema.safeParse(1234).success).toBe(true);
    });
});
describe("loginSchema", () => {
    it("accepts valid credentials", () => {
        expect(loginSchema.safeParse({ email: "a@b.com", password: "x" }).success).toBe(true);
    });
    it("rejects a bad email", () => {
        expect(loginSchema.safeParse({ email: "nope", password: "x" }).success).toBe(false);
    });
});
describe("registerSchema", () => {
    it("accepts a strong password", () => {
        const r = registerSchema.safeParse({
            email: "a@b.com",
            password: "longenough",
            displayName: "Alice",
        });
        expect(r.success).toBe(true);
    });
    it("rejects a short password", () => {
        const r = registerSchema.safeParse({
            email: "a@b.com",
            password: "short",
            displayName: "Alice",
        });
        expect(r.success).toBe(false);
    });
});
describe("activateSchema", () => {
    it("requires a token", () => {
        expect(activateSchema.safeParse({ token: "" }).success).toBe(false);
        expect(activateSchema.safeParse({ token: "abc" }).success).toBe(true);
    });
});
describe("householdSchema", () => {
    it("validates name + currency", () => {
        expect(householdSchema.safeParse({ name: "Home", default_currency: "HUF" }).success).toBe(true);
        expect(householdSchema.safeParse({ name: "Home", default_currency: "huf" }).success).toBe(false);
    });
});
describe("inviteSchema", () => {
    it("accepts a valid role from core", () => {
        expect(inviteSchema.safeParse({ email: "a@b.com", role: "MEMBER" }).success).toBe(true);
    });
    it("rejects an unknown role", () => {
        expect(inviteSchema.safeParse({ email: "a@b.com", role: "SUPERUSER" }).success).toBe(false);
    });
});
describe("obligationSchema", () => {
    it("accepts a minimal one-off obligation", () => {
        const r = obligationSchema.safeParse({
            title: "Pay insurance",
            category: "insurance",
            due_date: "2026-09-01",
        });
        expect(r.success).toBe(true);
        if (r.success)
            expect(r.data.lead_time_days).toBe(0);
    });
    it("accepts a recurring obligation with rrule and money", () => {
        const r = obligationSchema.safeParse({
            title: "Heat pump service",
            category: "maintenance",
            due_date: "2026-09-01",
            rrule: "FREQ=YEARLY",
            estimated_amount_minor: 50000,
            currency: "EUR",
            lead_time_days: 14,
        });
        expect(r.success).toBe(true);
    });
    it("rejects a malformed due_date", () => {
        expect(obligationSchema.safeParse({
            title: "x",
            category: "y",
            due_date: "09/01/2026",
        }).success).toBe(false);
    });
});
describe("expenseSchema", () => {
    it("accepts a valid expense", () => {
        expect(expenseSchema.safeParse({
            amount_minor: 1999,
            currency: "EUR",
            occurred_on: "2026-06-01",
            category: "utilities",
        }).success).toBe(true);
    });
    it("rejects a float minor amount", () => {
        expect(expenseSchema.safeParse({
            amount_minor: 19.99,
            currency: "EUR",
            occurred_on: "2026-06-01",
            category: "utilities",
        }).success).toBe(false);
    });
});
describe("serviceSchema", () => {
    it("accepts a valid service", () => {
        expect(serviceSchema.safeParse({
            provider_name: "Netflix",
            fee_amount_minor: 1999,
            currency: "EUR",
            billing_cycle: "MONTHLY",
        }).success).toBe(true);
    });
    it("rejects an unknown billing cycle", () => {
        expect(serviceSchema.safeParse({
            provider_name: "Netflix",
            fee_amount_minor: 1999,
            currency: "EUR",
            billing_cycle: "FORTNIGHTLY",
        }).success).toBe(false);
    });
});
