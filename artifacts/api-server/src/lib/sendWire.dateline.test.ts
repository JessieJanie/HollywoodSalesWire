import { beforeEach, describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({
  claim: undefined as any,
  inserted: undefined as any,
  messages: [] as any[],
}));

vi.mock("@workspace/db", () => {
  const paid = { weekKey: "weekKey", id: "id" };
  const members = {};
  return {
    paidWireSendsTable: paid,
    membersTable: members,
    emailSubscribersTable: {},
    weeklyPreviewsTable: {},
    db: {
      select: () => ({
        from: (table: unknown) => table === paid
          ? { where: async () => state.claim ? [state.claim] : [] }
          : Promise.resolve([{ id: 1, email: "member@example.com", stripeSubscriptionId: null }]),
      }),
      insert: () => ({
        values: (value: any) => {
          state.inserted = { id: 1, ...value };
          return {
            onConflictDoNothing: () => ({
              returning: async () => [state.inserted],
            }),
          };
        },
      }),
      update: () => ({ set: () => ({ where: async () => [] }) }),
    },
  };
});
vi.mock("./wireResearch", () => ({ currentWeekKey: () => "2026-10-12" }));
vi.mock("./resend", () => ({
  resendRequest: async (_path: string, request: any) => {
    state.messages.push(request);
    return {};
  },
}));
vi.mock("./emailSequence", () => ({
  FROM_ADDRESS: "test@example.com",
  SITE_URL: "https://example.com",
}));
vi.mock("../routes/reports", () => ({ shelfUrl: () => "https://example.com/shelf" }));
vi.mock("./logger", () => ({ logger: { error: vi.fn() } }));

import { executePaidSend } from "./sendWire";

describe("paid Wire dateline at the send boundary (no real email)", () => {
  const wrongBody = "# Hollywood Sales Wire\n**Tuesday, October 14, 2026**\n\nApproved story.";
  beforeEach(() => {
    state.claim = undefined;
    state.inserted = undefined;
    state.messages = [];
  });
  it("corrects a stale browser payload before freezing and sending a new claim", async () => {
    const result = await executePaidSend("This week's Wire", wrongBody);
    expect(result.ok).toBe(true);
    expect(state.inserted.bodyText).toContain("Tuesday, October 13, 2026");
    expect(state.messages[0].body[0].html).toContain("Tuesday, October 13, 2026");
    expect(state.messages[0].body[0].html).not.toContain("October 14");
  });
  it("never changes an already-frozen retry payload or its idempotency key", async () => {
    state.claim = {
      id: 17, weekKey: "2026-10-12", status: "sending",
      subject: "Frozen subject", bodyText: wrongBody,
      recipientEmails: ["member@example.com"], recipientCount: 0,
    };
    await executePaidSend("New subject", "A different body");
    expect(state.inserted).toBeUndefined();
    expect(state.messages[0].body[0].subject).toBe("Frozen subject");
    expect(state.messages[0].body[0].html).toContain("Tuesday, October 14, 2026");
    const key = state.messages[0].headers["Idempotency-Key"];
    await executePaidSend("Another subject", "Another body");
    expect(state.messages[1]).toEqual(state.messages[0]);
    expect(key).toBeTruthy();
  });
  it("does not send again when this week's claim is already sent", async () => {
    state.claim = { id: 17, status: "sent" };
    expect(await executePaidSend("Wire", wrongBody)).toMatchObject({ code: "already-sent" });
    expect(state.messages).toHaveLength(0);
  });
});
