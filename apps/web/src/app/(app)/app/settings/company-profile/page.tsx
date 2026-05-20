"use client";

import { useEffect, useState, type ReactNode } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "@convex/_generated/api";
import type { Id } from "@convex/_generated/dataModel";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";

const EMPTY_PROFILE = {
  legal: {
    legalName: "",
    tradingName: "",
    registrationNumber: "",
    incorporationCountry: "",
  },
  tax: {
    vatNumber: "",
    taxNumber: "",
    csdNumber: "",
  },
  banking: {
    accountHolderName: "",
    bankName: "",
    accountNumber: "",
    branchCode: "",
    accountType: "",
  },
  addresses: {
    physicalAddress: "",
    postalAddress: "",
  },
  contacts: {
    primaryContactName: "",
    primaryContactEmail: "",
    primaryContactPhone: "",
  },
  signatory: {
    fullName: "",
    title: "",
    email: "",
    phone: "",
  },
  compliance: {
    beeLevel: "",
    cidbGrade: "",
    oemSummary: "",
  },
};

function statusVariant(status: string): "secondary" | "destructive" | "outline" {
  if (status === "verified") return "secondary";
  if (status === "missing" || status === "rejected") return "destructive";
  return "outline";
}

function FieldGroup({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <Card className="border-border/40">
      <CardHeader>
        <CardTitle className="text-base normal-case">{title}</CardTitle>
      </CardHeader>
      <CardContent className="grid gap-3 md:grid-cols-2">{children}</CardContent>
    </Card>
  );
}

export default function CompanyProfilePage() {
  const profile = useQuery(api.companyProfiles.getActive, {});
  const documents = useQuery(
    api.documents.listByProfileWithUrls,
    profile?._id ? { profileId: profile._id } : "skip"
  );
  const verificationSummary = useQuery(
    api.companyProfiles.getVerificationSummary,
    profile?._id ? { profileId: profile._id } : "skip"
  );

  const createOrUpdateDraft = useMutation(api.companyProfiles.createOrUpdateDraft);
  const activateProfile = useMutation(api.companyProfiles.activate);
  const verifyField = useMutation(api.companyFieldVerifications.verifyField);
  const rejectField = useMutation(api.companyFieldVerifications.rejectField);

  const [formState, setFormState] = useState(EMPTY_PROFILE);
  const [verificationInputs, setVerificationInputs] = useState<
    Record<string, { sourceDocumentId?: string; sourcePage?: string; sourceQuote?: string }>
  >({});
  const [message, setMessage] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [activating, setActivating] = useState(false);

  useEffect(() => {
    if (!profile) {
      setFormState(EMPTY_PROFILE);
      return;
    }

    setFormState({
      legal: {
        legalName: profile.legal.legalName ?? "",
        tradingName: profile.legal.tradingName ?? "",
        registrationNumber: profile.legal.registrationNumber ?? "",
        incorporationCountry: profile.legal.incorporationCountry ?? "",
      },
      tax: {
        vatNumber: profile.tax.vatNumber ?? "",
        taxNumber: profile.tax.taxNumber ?? "",
        csdNumber: profile.tax.csdNumber ?? "",
      },
      banking: {
        accountHolderName: profile.banking.accountHolderName ?? "",
        bankName: profile.banking.bankName ?? "",
        accountNumber: profile.banking.accountNumber ?? "",
        branchCode: profile.banking.branchCode ?? "",
        accountType: profile.banking.accountType ?? "",
      },
      addresses: {
        physicalAddress: profile.addresses.physicalAddress ?? "",
        postalAddress: profile.addresses.postalAddress ?? "",
      },
      contacts: {
        primaryContactName: profile.contacts.primaryContactName ?? "",
        primaryContactEmail: profile.contacts.primaryContactEmail ?? "",
        primaryContactPhone: profile.contacts.primaryContactPhone ?? "",
      },
      signatory: {
        fullName: profile.signatory.fullName ?? "",
        title: profile.signatory.title ?? "",
        email: profile.signatory.email ?? "",
        phone: profile.signatory.phone ?? "",
      },
      compliance: {
        beeLevel: profile.compliance.beeLevel ?? "",
        cidbGrade: profile.compliance.cidbGrade ?? "",
        oemSummary: profile.compliance.oemSummary ?? "",
      },
    });
  }, [profile]);

  const handleChange = (section: keyof typeof EMPTY_PROFILE, field: string, value: string) => {
    setFormState((current) => ({
      ...current,
      [section]: {
        ...current[section],
        [field]: value,
      },
    }));
  };

  const handleSave = async () => {
    setSaving(true);
    setMessage(null);
    try {
      await createOrUpdateDraft({
        profileId: profile?._id,
        input: {
          workspaceKey: "main",
          legal: formState.legal,
          tax: formState.tax,
          banking: formState.banking,
          addresses: formState.addresses,
          contacts: formState.contacts,
          signatory: formState.signatory,
          compliance: formState.compliance,
        },
      });
      setMessage("Profile saved.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Failed to save profile.");
    } finally {
      setSaving(false);
    }
  };

  const handleActivate = async () => {
    if (!profile?._id) return;
    setActivating(true);
    setMessage(null);
    try {
      await activateProfile({ profileId: profile._id });
      setMessage("Profile activated.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Failed to activate profile.");
    } finally {
      setActivating(false);
    }
  };

  const handleVerifyField = async (fieldPath: string) => {
    if (!profile?._id) return;
    const input = verificationInputs[fieldPath];
    try {
      await verifyField({
        profileId: profile._id,
        fieldPath,
        sourceDocumentId: input?.sourceDocumentId
          ? (input.sourceDocumentId as Id<"documents">)
          : undefined,
        sourcePage: input?.sourcePage ? Number(input.sourcePage) : undefined,
        sourceQuote: input?.sourceQuote || undefined,
      });
      setMessage(`Verified ${fieldPath}.`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Verification failed.");
    }
  };

  const handleRejectField = async (fieldPath: string) => {
    if (!profile?._id) return;
    const input = verificationInputs[fieldPath];
    try {
      await rejectField({
        profileId: profile._id,
        fieldPath,
        sourceDocumentId: input?.sourceDocumentId
          ? (input.sourceDocumentId as Id<"documents">)
          : undefined,
        sourcePage: input?.sourcePage ? Number(input.sourcePage) : undefined,
        sourceQuote: input?.sourceQuote || undefined,
      });
      setMessage(`Rejected verification for ${fieldPath}.`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Rejection failed.");
    }
  };

  const companyDocs = documents ?? [];

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="space-y-1">
          <h2 className="text-2xl font-semibold tracking-tight">Company Profile</h2>
          <p className="text-sm text-muted-foreground">
            Maintain the canonical facts that all form filling and document matching must trust.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={handleSave} disabled={saving}>
            {saving ? "Saving..." : "Save Draft"}
          </Button>
          <Button onClick={handleActivate} disabled={!profile?._id || activating}>
            {activating ? "Activating..." : "Activate Profile"}
          </Button>
        </div>
      </div>

      {message && (
        <div className="rounded-md border border-border/50 bg-background/40 px-4 py-3 text-sm">
          {message}
        </div>
      )}

      <Card className="border-border/40">
        <CardHeader className="flex-row items-center justify-between space-y-0">
          <div>
            <CardTitle className="text-base normal-case">Verification Summary</CardTitle>
            <p className="mt-1 text-sm text-muted-foreground">
              Critical fields must be verified before the profile can become active.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant="outline">
              {verificationSummary?.completedCriticalFields ?? 0}/
              {verificationSummary?.totalCriticalFields ?? 0} verified
            </Badge>
            {profile?.status && <Badge variant="secondary">{profile.status}</Badge>}
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {verificationSummary?.fields.map((field) => (
              <div key={field.fieldPath} className="rounded-lg border border-border/40 p-3">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-sm font-medium">{field.label}</p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {field.value || "No value entered yet"}
                    </p>
                  </div>
                  <Badge variant={statusVariant(field.status)}>{field.status}</Badge>
                </div>

                <div className="mt-3 space-y-2">
                  <select
                    value={verificationInputs[field.fieldPath]?.sourceDocumentId ?? ""}
                    onChange={(event) =>
                      setVerificationInputs((current) => ({
                        ...current,
                        [field.fieldPath]: {
                          ...current[field.fieldPath],
                          sourceDocumentId: event.target.value || undefined,
                        },
                      }))
                    }
                    className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                  >
                    <option value="">Select source document</option>
                    {companyDocs.map((document) => (
                      <option key={document._id} value={document._id}>
                        {document.filename}
                      </option>
                    ))}
                  </select>
                  <Input
                    placeholder="Source page"
                    value={verificationInputs[field.fieldPath]?.sourcePage ?? ""}
                    onChange={(event) =>
                      setVerificationInputs((current) => ({
                        ...current,
                        [field.fieldPath]: {
                          ...current[field.fieldPath],
                          sourcePage: event.target.value,
                        },
                      }))
                    }
                  />
                  <Textarea
                    placeholder="Supporting quote"
                    value={verificationInputs[field.fieldPath]?.sourceQuote ?? ""}
                    onChange={(event) =>
                      setVerificationInputs((current) => ({
                        ...current,
                        [field.fieldPath]: {
                          ...current[field.fieldPath],
                          sourceQuote: event.target.value,
                        },
                      }))
                    }
                    className="min-h-[90px]"
                  />
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      className="flex-1"
                      onClick={() => handleVerifyField(field.fieldPath)}
                    >
                      Verify
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      className="flex-1"
                      onClick={() => handleRejectField(field.fieldPath)}
                    >
                      Reject
                    </Button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <FieldGroup title="Legal">
        <Input
          placeholder="Legal name"
          value={formState.legal.legalName}
          onChange={(event) => handleChange("legal", "legalName", event.target.value)}
        />
        <Input
          placeholder="Trading name"
          value={formState.legal.tradingName}
          onChange={(event) => handleChange("legal", "tradingName", event.target.value)}
        />
        <Input
          placeholder="Registration number"
          value={formState.legal.registrationNumber}
          onChange={(event) => handleChange("legal", "registrationNumber", event.target.value)}
        />
        <Input
          placeholder="Incorporation country"
          value={formState.legal.incorporationCountry}
          onChange={(event) => handleChange("legal", "incorporationCountry", event.target.value)}
        />
      </FieldGroup>

      <FieldGroup title="Tax">
        <Input
          placeholder="VAT number"
          value={formState.tax.vatNumber}
          onChange={(event) => handleChange("tax", "vatNumber", event.target.value)}
        />
        <Input
          placeholder="Tax number"
          value={formState.tax.taxNumber}
          onChange={(event) => handleChange("tax", "taxNumber", event.target.value)}
        />
        <Input
          placeholder="CSD number"
          value={formState.tax.csdNumber}
          onChange={(event) => handleChange("tax", "csdNumber", event.target.value)}
        />
      </FieldGroup>

      <FieldGroup title="Banking">
        <Input
          placeholder="Account holder name"
          value={formState.banking.accountHolderName}
          onChange={(event) => handleChange("banking", "accountHolderName", event.target.value)}
        />
        <Input
          placeholder="Bank name"
          value={formState.banking.bankName}
          onChange={(event) => handleChange("banking", "bankName", event.target.value)}
        />
        <Input
          placeholder="Account number"
          value={formState.banking.accountNumber}
          onChange={(event) => handleChange("banking", "accountNumber", event.target.value)}
        />
        <Input
          placeholder="Branch code"
          value={formState.banking.branchCode}
          onChange={(event) => handleChange("banking", "branchCode", event.target.value)}
        />
        <Input
          placeholder="Account type"
          value={formState.banking.accountType}
          onChange={(event) => handleChange("banking", "accountType", event.target.value)}
        />
      </FieldGroup>

      <FieldGroup title="Addresses">
        <Textarea
          placeholder="Physical address"
          value={formState.addresses.physicalAddress}
          onChange={(event) => handleChange("addresses", "physicalAddress", event.target.value)}
        />
        <Textarea
          placeholder="Postal address"
          value={formState.addresses.postalAddress}
          onChange={(event) => handleChange("addresses", "postalAddress", event.target.value)}
        />
      </FieldGroup>

      <FieldGroup title="Contacts">
        <Input
          placeholder="Primary contact name"
          value={formState.contacts.primaryContactName}
          onChange={(event) => handleChange("contacts", "primaryContactName", event.target.value)}
        />
        <Input
          placeholder="Primary contact email"
          value={formState.contacts.primaryContactEmail}
          onChange={(event) => handleChange("contacts", "primaryContactEmail", event.target.value)}
        />
        <Input
          placeholder="Primary contact phone"
          value={formState.contacts.primaryContactPhone}
          onChange={(event) => handleChange("contacts", "primaryContactPhone", event.target.value)}
        />
      </FieldGroup>

      <FieldGroup title="Signatory">
        <Input
          placeholder="Signatory full name"
          value={formState.signatory.fullName}
          onChange={(event) => handleChange("signatory", "fullName", event.target.value)}
        />
        <Input
          placeholder="Signatory title"
          value={formState.signatory.title}
          onChange={(event) => handleChange("signatory", "title", event.target.value)}
        />
        <Input
          placeholder="Signatory email"
          value={formState.signatory.email}
          onChange={(event) => handleChange("signatory", "email", event.target.value)}
        />
        <Input
          placeholder="Signatory phone"
          value={formState.signatory.phone}
          onChange={(event) => handleChange("signatory", "phone", event.target.value)}
        />
      </FieldGroup>

      <FieldGroup title="Compliance">
        <Input
          placeholder="B-BBEE level"
          value={formState.compliance.beeLevel}
          onChange={(event) => handleChange("compliance", "beeLevel", event.target.value)}
        />
        <Input
          placeholder="CIDB grade"
          value={formState.compliance.cidbGrade}
          onChange={(event) => handleChange("compliance", "cidbGrade", event.target.value)}
        />
        <Textarea
          placeholder="OEM summary"
          value={formState.compliance.oemSummary}
          onChange={(event) => handleChange("compliance", "oemSummary", event.target.value)}
          className="md:col-span-2"
        />
      </FieldGroup>
    </div>
  );
}
