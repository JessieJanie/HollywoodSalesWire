import { describe, expect, it } from "vitest";
import { ingestFetchedSources, parseCaApprovedHtml } from "./greenlightIngest";

const caHtml = `<table><tr><td>Fiscal Year</td><td>Production Title</td><td>Company Name</td><td>Production Type</td><td>Independent</td><td>CA Filming Days</td><td>Cast</td><td>Crew</td><td>Background</td><td>Qualified</td><td>Credit</td><td>Date</td></tr>
<tr><td>2026-2027</td><td>Michael 2 (working title)*</td><td>LIONSGATE</td><td>Non-Independent Feature Film Live Action</td><td>Non-Independent</td><td>55</td><td>65</td><td>300</td><td>5220</td><td>$86,725,000</td><td>$30,837,000</td><td>9/21/2026</td></tr></table>`;

describe("greenlight ingest", () => {
  it("parses a California approved-projects table and skips the header", () => {
    const rows = parseCaApprovedHtml(caHtml, "2026-11-15T00:00:00.000Z");
    expect(rows).toHaveLength(1);
    expect(rows[0]?.company).toBe("LIONSGATE");
    expect(rows[0]?.jobs).toBe("cast 65, crew 300");
  });

  it("records unreachable state sites and a stale NYC permit extract without inventing rows", () => {
    const now = new Date("2026-11-15T18:00:00.000Z");
    const result = ingestFetchedSources(
      [
        { id: "ca-film-commission", url: "https://film.ca.gov/film-and-television-tax-credit-program-approved-projects-list/", ok: false, statusCode: 0, body: "" },
        { id: "ny-esd", url: "https://esd.ny.gov/industries/film-tax-credit", ok: false, statusCode: 404, body: "" },
        { id: "ga-film", url: "https://www.georgia.org/industries/film-entertainment", ok: false, statusCode: 403, body: "" },
        {
          id: "nyc-permits",
          url: "https://data.cityofnewyork.us/resource/tg4x-b46p.json",
          ok: true,
          statusCode: 200,
          body: JSON.stringify([
            { eventid: "9", eventtype: "Shooting Permit", category: "Television", subcategoryname: "Episodic series", startdatetime: "2026-08-15T14:00:00.000" },
          ]),
        },
      ],
      now,
    );
    expect(result.attempts.find((attempt) => attempt.id === "ca-film-commission")?.status).toBe("unreachable");
    expect(result.attempts.find((attempt) => attempt.id === "ny-esd")?.detail).toContain("404");
    expect(result.attempts.find((attempt) => attempt.id === "ga-film")?.detail).toContain("403");
    expect(result.attempts.find((attempt) => attempt.id === "nyc-permits")?.status).toBe("stale");
    expect(result.attempts.find((attempt) => attempt.id === "tx-tmiiip")?.status).toBe("unreachable");
    expect(result.productions).toHaveLength(1);
    expect(result.productions[0]?.status).toContain("stale");
  });
});
