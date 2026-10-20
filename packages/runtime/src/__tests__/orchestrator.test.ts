import { describe, expect, it, vi } from "vitest";
import { BoundedLog, redactCredentials } from "../orchestrator";

describe("runtime logging safety", () => {
  it("redacts URL passwords and common secret assignments", () => {
    expect(redactCredentials("DATABASE_URL=postgresql://tester:super-secret@127.0.0.1/test_db?schema=test_one"))
      .toContain("postgresql://tester:***@127.0.0.1/test_db?schema=test_one");
    expect(redactCredentials("password=hunter2 token:abc123 api_key=xyz"))
      .toBe("password=*** token:*** api_key=***");
  });

  it("redacts credentials that arrive split across chunks", () => {
    const log = new BoundedLog(10, 4_096);
    log.append("DATABASE_URL=postgresql://tester:super-");
    log.append("secret@127.0.0.1/test_db?schema=test_one\n");

    const output = log.get();
    expect(output).toContain("postgresql://tester:***@127.0.0.1/test_db");
    expect(output).not.toContain("super-secret");
  });

  it("enforces both line and byte caps with accurate eviction", () => {
    const log = new BoundedLog(3, 256);
    log.append("line-one\nline-two\nline-three\nline-four\n");
    expect(log.get()).toBe("line-two\nline-three\nline-four");
    log.append(`${"x".repeat(300)}\n`);
    expect(Buffer.byteLength(log.get(), "utf8")).toBeLessThanOrEqual(256);
    expect(log.get()).toContain("[OVERSIZED LOG LINE OMITTED]");
  });

  it("does not publish unbounded log chunks to observers", () => {
    const onLog = vi.fn();
    const log = new BoundedLog(10, 4_096, "stdout", { onLog });
    log.append(`${"A".repeat(3_000)}\n`);
    expect(onLog).toHaveBeenCalledTimes(1);
    const payload = onLog.mock.calls[0]?.[1] ?? "";
    expect(Buffer.byteLength(payload, "utf8")).toBeLessThanOrEqual(2_048);
  });

  it("omits an unterminated final fragment to avoid leaking a partial credential", () => {
    const log = new BoundedLog(10, 1_024);
    log.append("DATABASE_URL=postgresql://tester:unfinished-secret");
    expect(log.get()).toBe("");
    log.flush();
    expect(log.get()).toContain("FINAL UNTERMINATED LOG LINE OMITTED");
    expect(log.get()).not.toContain("unfinished-secret");
  });

  it("discards a single oversized unterminated line until the next newline", () => {
    const log = new BoundedLog(10, 256);
    log.append(`${"x".repeat(300)}`);
    log.append(`still-the-same-line\nsafe-line\n`);
    expect(log.get()).toContain("[OVERSIZED LOG LINE OMITTED]");
    expect(log.get()).toContain("safe-line");
    expect(log.get()).not.toContain("still-the-same-line");
  });

  it("redacts Bearer tokens, JSON secrets, and authorization assignments before observers", () => {
    const observed: string[] = [];
    const log = new BoundedLog(20, 4_096, "stderr", {
      onLog: (_stream, chunk) => observed.push(chunk),
    });
    log.append("Authorization: Bearer bearer-super-secret\n");
    log.append('{"password":"json-super-secret","token":"json-token-secret"}\n');
    log.append("authorization=assigned-super-secret API_KEY=key-super-secret\n");

    const stored = log.get();
    const observedText = observed.join("\n");
    for (const secret of ["bearer-super-secret", "json-super-secret", "json-token-secret", "assigned-super-secret", "key-super-secret"]) {
      expect(stored).not.toContain(secret);
      expect(observedText).not.toContain(secret);
    }
    expect(stored).toContain('"password":"***"');
  });

  it("never exposes incomplete, potentially credential-bearing lines", () => {
    const observed: string[] = [];
    const log = new BoundedLog(10, 1_024, "stdout", {
      onLog: (_stream, chunk) => observed.push(chunk),
    });
    log.append("Authorization: Bearer partial-secret-value");
    expect(log.get()).toBe("");
    expect(observed).toHaveLength(0);
    log.append("\n");
    expect(log.get()).not.toContain("partial-secret-value");
    expect(observed.join("\n")).not.toContain("partial-secret-value");
  });

  it("isolates observer callback failures", () => {
    const log = new BoundedLog(10, 1_024, "stdout", {
      onLog: () => { throw new Error("consumer failure"); },
    });
    expect(() => log.append("safe line\n")).not.toThrow();
    expect(log.get()).toBe("safe line");
  });
});