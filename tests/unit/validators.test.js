import { validateCompanyRecord, validateJobRecord } from "../../src/validators.js";

describe("validateCompanyRecord", () => {
  it("accepts valid company record", () => {
    const record = {
      id: "company-12345678",
      company: "TEST COMPANY SRL",
      cif: 12345678,
      brand: "TEST COMPANY",
      status: "activ",
      location: ["București"],
      lastScraped: "2026-06-28",
    };
    const result = validateCompanyRecord(record);
    expect(result.valid).toBe(true);
  });

  it("rejects missing cif", () => {
    const record = { id: "test", company: "Test" };
    const result = validateCompanyRecord(record);
    expect(result.valid).toBe(false);
    expect(result.errors).toContain("missing cif");
  });

  it("rejects brand not uppercase", () => {
    const record = {
      id: "company-12345678",
      company: "Test",
      cif: 12345678,
      brand: "test company",
      lastScraped: "2026-06-28",
    };
    const result = validateCompanyRecord(record);
    expect(result.valid).toBe(false);
    expect(result.errors).toContain("brand not uppercase");
  });
});

describe("validateJobRecord", () => {
  it("accepts valid job record", () => {
    const record = {
      id: "job-12345678-abc123",
      url: "https://example.com/job/1",
      title: "Test Job",
      cif: "12345678",
      workmode: "remote",
      tags: ["test", "inviitor.ro"],
      date: "2026-06-28T00:00:00Z",
    };
    const result = validateJobRecord(record);
    expect(result.valid).toBe(true);
  });

  it("rejects missing url", () => {
    const record = { id: "test", title: "Test" };
    const result = validateJobRecord(record);
    expect(result.valid).toBe(false);
    expect(result.errors).toContain("missing url");
  });

  it("rejects invalid workmode", () => {
    const record = {
      id: "test",
      url: "https://example.com",
      title: "Test",
      cif: "12345678",
      workmode: "invalid",
      date: "2026-06-28T00:00:00Z",
    };
    const result = validateJobRecord(record);
    expect(result.valid).toBe(false);
    expect(result.errors).toContain("invalid workmode: invalid");
  });
});
