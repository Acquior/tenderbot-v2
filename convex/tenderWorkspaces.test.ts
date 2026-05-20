import { describe, expect, test } from "bun:test";
import {
  getFolderForRequirement,
  isApprovedAndCurrent,
  isLikelyFormDocument,
  requirementSuggestsForm,
} from "./tenderWorkspaces";

describe("tender workspace helpers", () => {
  test("requirements map into deterministic export folders", () => {
    expect(getFolderForRequirement({ documentCategoryNeeded: "legal" })).toBe("02_Compliance");
    expect(getFolderForRequirement({ documentCategoryNeeded: "technical" })).toBe("03_Technical");
    expect(getFolderForRequirement({ type: "commercial" })).toBe("05_Commercial");
    expect(getFolderForRequirement({})).toBe("07_Generated");
  });

  test("approved company documents must still be current", () => {
    expect(
      isApprovedAndCurrent({
        validityStatus: "approved",
        expiresAt: Date.now() + 10_000,
      })
    ).toBe(true);

    expect(
      isApprovedAndCurrent({
        validityStatus: "approved",
        expiresAt: Date.now() - 10_000,
      })
    ).toBe(false);

    expect(
      isApprovedAndCurrent({
        validityStatus: "draft",
      })
    ).toBe(false);
  });

  test("form-like requirements are detected explicitly", () => {
    expect(
      requirementSuggestsForm({
        formFillNeeded: true,
        description: "Complete the pricing schedule",
      })
    ).toBe(true);

    expect(
      requirementSuggestsForm({
        documentCategoryNeeded: "sbd_form",
        description: "Submit SBD documents",
      })
    ).toBe(true);

    expect(
      requirementSuggestsForm({
        description: "Attach latest bank confirmation letter",
      })
    ).toBe(false);
  });

  test("form detection is conservative for bundle PDFs", () => {
    const formRequirements = [
      {
        formFillNeeded: true,
        description: "Complete the declaration form",
      },
    ];

    expect(
      isLikelyFormDocument(
        {
          filename: "SBD 4 Declaration.pdf",
          mimeType: "application/pdf",
        },
        [],
        5
      )
    ).toBe(true);

    expect(
      isLikelyFormDocument(
        {
          filename: "Tender Pack Volume 1.pdf",
          mimeType: "application/pdf",
        },
        formRequirements,
        5
      )
    ).toBe(false);

    expect(
      isLikelyFormDocument(
        {
          filename: "Tender Pack Volume 1.pdf",
          mimeType: "application/pdf",
        },
        formRequirements,
        1
      )
    ).toBe(true);
  });
});
