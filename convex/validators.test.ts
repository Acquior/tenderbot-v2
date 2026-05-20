import { describe, expect, test } from "bun:test";
import {
  documentNotExpired,
  getValueAtPath,
  isCriticalProfileField,
  requiredString,
  singleCandidateOnly,
  validateDate,
  validateEmail,
  validatePhone,
} from "./validators";

describe("validators", () => {
  test("requiredString rejects empty values", () => {
    expect(requiredString("")).toEqual({
      status: "invalid",
      message: "Value is required.",
    });
    expect(requiredString("ready")).toEqual({ status: "valid" });
  });

  test("email and phone validators enforce basic shape", () => {
    expect(validateEmail("tenders@example.com").status).toBe("valid");
    expect(validateEmail("broken-email").status).toBe("invalid");

    expect(validatePhone("+27 82 123 4567").status).toBe("valid");
    expect(validatePhone("123").status).toBe("invalid");
  });

  test("date validator rejects invalid dates", () => {
    expect(validateDate("2026-04-16").status).toBe("valid");
    expect(validateDate("not-a-date").status).toBe("invalid");
  });

  test("documentNotExpired blocks expired documents", () => {
    expect(documentNotExpired(Date.now() + 60_000).status).toBe("valid");
    expect(documentNotExpired(Date.now() - 60_000).status).toBe("invalid");
  });

  test("singleCandidateOnly distinguishes missing, unique, and conflicting candidates", () => {
    expect(singleCandidateOnly([]).status).toBe("unverified");
    expect(singleCandidateOnly(["only"]).status).toBe("valid");
    expect(singleCandidateOnly(["first", "second"]).status).toBe("conflict");
  });

  test("critical profile fields are explicitly tracked", () => {
    expect(isCriticalProfileField("legal.registrationNumber")).toBe(true);
    expect(isCriticalProfileField("contacts.primaryContactEmail")).toBe(false);
  });

  test("getValueAtPath resolves nested values safely", () => {
    const profile = {
      legal: {
        legalName: "TenderBot Logistics",
      },
      signatory: {
        title: "Director",
      },
    };

    expect(getValueAtPath(profile, "legal.legalName")).toBe("TenderBot Logistics");
    expect(getValueAtPath(profile, "signatory.title")).toBe("Director");
    expect(getValueAtPath(profile, "missing.path")).toBeUndefined();
  });
});
