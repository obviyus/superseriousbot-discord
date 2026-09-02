import { describe, expect, test } from "bun:test";
import { extractSearchUrl } from "~/features/hltb";

describe("extractSearchUrl", () => {
	test("preserves the complete nested search route", () => {
		const script = 'fetch("/api/search/site", { method: "POST" })';

		expect(extractSearchUrl(script)).toBe("/api/search/site");
	});
});
