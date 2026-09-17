/**
 * Route test for GET /publisher/production-stages (Task 82).
 *
 * The pure stage-estimation logic in productionStage.ts is already covered by
 * productionStage.test.ts. This file covers the HTTP surface the dashboard
 * actually depends on: the key check, the response shape/status codes, and
 * that the response body reflects whatever listTrackedProjectStages returns
 * (including the empty-projects case) — a regression here (wrong status
 * code, wrong field name, auth bypass) would otherwise only be caught by a
 * human noticing the dashboard looks wrong.
 */
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import express, { type Express } from "express";
import http from "node:http";
import type { AddressInfo } from "node:net";

const sampleProjects: TrackedProjectStage[] = [
  {
    sourceType: "entity_formation",
    name: "Test Pictures LLC",
    jurisdiction: "Delaware",
    sourceUrl: "https://example.com/filing",
    triggerDate: "2026-08-01T00:00:00.000Z",
    stage: "Crew build-out",
    vendorWindow: "DP, gaffer, grip, camera, wardrobe, art department",
    weeksSinceTrigger: 3.1,
  },
];

vi.mock("../lib/productionStage", async () => {
  const actual =
    await vi.importActual<typeof import("../lib/productionStage")>(
      "../lib/productionStage",
    );
  return {
    ...actual,
    listTrackedProjectStages: vi.fn(),
  };
});

import {
  listTrackedProjectStages,
  type TrackedProjectStage,
} from "../lib/productionStage";

const mockedList = vi.mocked(listTrackedProjectStages);

const TEST_KEY = "test-publisher-key-task82";

interface ProductionStagesResponse {
  projects: TrackedProjectStage[];
}

interface ErrorResponse {
  error: string;
}

describe("GET /publisher/production-stages", () => {
  const prevKey = process.env.PUBLISHER_KEY;
  let server: http.Server;
  let baseUrl: string;

  beforeAll(async () => {
    process.env.PUBLISHER_KEY = TEST_KEY;
    // Import after PUBLISHER_KEY is set and productionStage is mocked, so the
    // route module reads the test key when it evaluates keyOk().
    const { default: publisherRouter } = await import("./publisher");
    const app: Express = express();
    app.use(publisherRouter);
    server = app.listen(0);
    await new Promise<void>((resolve) => server.once("listening", () => resolve()));
    const { port } = server.address() as AddressInfo;
    baseUrl = `http://127.0.0.1:${port}`;
  });

  afterAll(async () => {
    process.env.PUBLISHER_KEY = prevKey;
    await new Promise((resolve) => server.close(resolve));
  });

  it("rejects a request with no key (401)", async () => {
    const res = await fetch(`${baseUrl}/publisher/production-stages`);
    expect(res.status).toBe(401);
    const body = (await res.json()) as ErrorResponse;
    expect(body).toHaveProperty("error");
    expect(mockedList).not.toHaveBeenCalled();
  });

  it("rejects a request with the wrong key (401)", async () => {
    mockedList.mockClear();
    const res = await fetch(
      `${baseUrl}/publisher/production-stages?key=${encodeURIComponent("not-the-key")}`,
    );
    expect(res.status).toBe(401);
    expect(mockedList).not.toHaveBeenCalled();
  });

  it("returns 200 with an empty projects array when no projects are tracked", async () => {
    mockedList.mockResolvedValueOnce([]);
    const res = await fetch(
      `${baseUrl}/publisher/production-stages?key=${encodeURIComponent(TEST_KEY)}`,
    );
    expect(res.status).toBe(200);
    const body = (await res.json()) as ProductionStagesResponse;
    expect(body).toEqual({ projects: [] });
  });

  it("returns 200 with projects that reflect listTrackedProjectStages and match the TrackedProjectStage shape", async () => {
    mockedList.mockResolvedValueOnce(sampleProjects);
    const res = await fetch(
      `${baseUrl}/publisher/production-stages?key=${encodeURIComponent(TEST_KEY)}`,
    );
    expect(res.status).toBe(200);
    const body = (await res.json()) as ProductionStagesResponse;
    expect(body).toEqual({ projects: sampleProjects });

    const [project] = body.projects;
    expect(project).toMatchObject({
      sourceType: expect.any(String),
      name: expect.any(String),
      jurisdiction: expect.any(String),
      sourceUrl: expect.any(String),
      triggerDate: expect.any(String),
      stage: expect.any(String),
      vendorWindow: expect.any(String),
      weeksSinceTrigger: expect.any(Number),
    });
  });
});
