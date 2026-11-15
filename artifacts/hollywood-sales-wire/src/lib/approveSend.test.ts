import { describe, expect, it } from "vitest";
import { briefApprovePayload, paidApprovePayload } from "./approveSend";

const ready = {
  weekKey: "2026-11-09",
  wireMarkdown: "A".repeat(120),
  freeSubject: "This week's brief",
  freeBody: "B".repeat(80),
};

describe("approve-and-send payloads", () => {
  it("builds the paid Wire from the ready draft and keeps the week in the subject", () => {
    expect(paidApprovePayload(ready)).toEqual({
      subject: "Hollywood Sales Wire — Week of 2026-11-09",
      bodyText: "A".repeat(120),
    });
  });

  it("sends the unsaved edit when the publisher has one open", () => {
    const edited = "C".repeat(150);
    expect(paidApprovePayload(ready, edited)?.bodyText).toBe(edited);
  });

  it("refuses a paid send without a week key or a real draft", () => {
    expect(paidApprovePayload({ ...ready, weekKey: "" })).toBeNull();
    expect(paidApprovePayload({ ...ready, wireMarkdown: "short" })).toBeNull();
  });

  it("builds the Brief from the free draft and refuses a stub", () => {
    expect(briefApprovePayload(ready)).toEqual({
      subject: "This week's brief",
      bodyText: "B".repeat(80),
    });
    expect(briefApprovePayload({ ...ready, freeBody: "nope" })).toBeNull();
  });
});
