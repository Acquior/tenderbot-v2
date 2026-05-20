import { internalQuery } from "./_generated/server";
import { v } from "convex/values";

export type ValidationStatus = "valid" | "invalid" | "unverified" | "conflict";

export interface ValidationResult {
  status: ValidationStatus;
  message?: string;
}

export const CRITICAL_PROFILE_FIELDS = [
  "legal.legalName",
  "legal.registrationNumber",
  "tax.vatNumber",
  "tax.taxNumber",
  "banking.accountHolderName",
  "banking.bankName",
  "banking.accountNumber",
  "banking.branchCode",
  "signatory.fullName",
  "signatory.title",
] as const;

export function isCriticalProfileField(fieldPath: string): boolean {
  return CRITICAL_PROFILE_FIELDS.includes(fieldPath as (typeof CRITICAL_PROFILE_FIELDS)[number]);
}

export function requiredString(value: string | undefined | null): ValidationResult {
  if (typeof value !== "string" || value.trim().length === 0) {
    return { status: "invalid", message: "Value is required." };
  }
  return { status: "valid" };
}

export function validateEmail(value: string | undefined | null): ValidationResult {
  if (!value) return { status: "invalid", message: "Email is required." };
  const ok = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
  return ok ? { status: "valid" } : { status: "invalid", message: "Invalid email format." };
}

export function validatePhone(value: string | undefined | null): ValidationResult {
  if (!value) return { status: "invalid", message: "Phone number is required." };
  const normalized = value.replace(/[^\d+]/g, "");
  return normalized.length >= 10
    ? { status: "valid" }
    : { status: "invalid", message: "Phone number appears incomplete." };
}

export function validateDate(value: string | undefined | null): ValidationResult {
  if (!value) return { status: "invalid", message: "Date is required." };
  return Number.isNaN(Date.parse(value))
    ? { status: "invalid", message: "Invalid date." }
    : { status: "valid" };
}

export function validateCheckboxBoolean(value: string | undefined | null): ValidationResult {
  if (!value) {
    return { status: "invalid", message: "Checkbox value is required." };
  }
  const normalized = value.toLowerCase();
  return ["true", "false", "yes", "no", "1", "0", "on", "off"].includes(normalized)
    ? { status: "valid" }
    : { status: "invalid", message: "Invalid checkbox value." };
}

export function regexByFieldType(
  value: string | undefined | null,
  regex: RegExp,
  message: string
): ValidationResult {
  if (!value) return { status: "invalid", message };
  return regex.test(value) ? { status: "valid" } : { status: "invalid", message };
}

export function documentNotExpired(expiresAt?: number): ValidationResult {
  if (!expiresAt) {
    return { status: "valid" };
  }
  return expiresAt >= Date.now()
    ? { status: "valid" }
    : { status: "invalid", message: "Document has expired." };
}

export function singleCandidateOnly<T>(candidates: T[]): ValidationResult {
  if (candidates.length === 1) return { status: "valid" };
  if (candidates.length === 0) return { status: "unverified", message: "No candidate found." };
  return { status: "conflict", message: "Multiple candidates found." };
}

export function getValueAtPath(record: Record<string, any> | undefined, path: string): unknown {
  if (!record) return undefined;
  return path.split(".").reduce<unknown>((current, part) => {
    if (current && typeof current === "object" && part in (current as Record<string, unknown>)) {
      return (current as Record<string, unknown>)[part];
    }
    return undefined;
  }, record);
}

export const exactVerifiedField = internalQuery({
  args: {
    profileId: v.id("companyProfiles"),
    fieldPath: v.string(),
    value: v.string(),
  },
  handler: async (ctx, args): Promise<ValidationResult> => {
    const profile = await ctx.db.get(args.profileId);
    if (!profile) {
      return { status: "invalid", message: "Company profile not found." };
    }

    const liveValue = getValueAtPath(profile as Record<string, any>, args.fieldPath);
    if (typeof liveValue !== "string" || liveValue.trim() !== args.value.trim()) {
      return { status: "conflict", message: "Current profile value differs from resolved value." };
    }

    const verifications = await ctx.db
      .query("companyFieldVerifications")
      .withIndex("by_profile_field", (q) =>
        q.eq("profileId", args.profileId).eq("fieldPath", args.fieldPath)
      )
      .order("desc")
      .take(20);

    const latest = verifications[0];
    if (!latest) {
      return { status: "unverified", message: "Field has not been verified." };
    }

    if (latest.status !== "verified") {
      return {
        status: latest.status === "rejected" ? "invalid" : "unverified",
        message: `Field verification status is ${latest.status}.`,
      };
    }

    if (latest.valueSnapshot.trim() !== args.value.trim()) {
      return { status: "conflict", message: "Verified value snapshot no longer matches." };
    }

    return { status: "valid" };
  },
});
