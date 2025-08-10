import { load } from "cheerio";

const BASE_URL = "https://howlongtobeat.com/";
const REFERER_HEADER = BASE_URL;
const GAME_URL = `${BASE_URL}game`;
const FALLBACK_SEARCH_URL_SUFFIX = "api/s/";

export enum SearchModifiers {
	NONE = "",
	ISOLATE_DLC = "only_dlc",
	ISOLATE_MODS = "only_mods",
	ISOLATE_HACKS = "only_hacks",
	HIDE_DLC = "hide_dlc",
}

interface SearchPayload {
	searchType: string;
	searchTerms: string[];
	searchPage: number;
	size: number;
	searchOptions: {
		games: {
			userId: number;
			platform: string;
			sortCategory: string;
			rangeCategory: string;
			rangeTime: { min: number; max: number };
			gameplay: {
				perspective: string;
				flow: string;
				genre: string;
				difficulty: string;
			};
			rangeYear: { max: string; min: string };
			modifier: string;
		};
		users: { sortCategory: string; id?: string };
		lists: { sortCategory: string };
		filter: string;
		sort: number;
		randomizer: number;
	};
	useCache: boolean;
}

class SearchInformations {
	searchUrl: string | null = null;
	apiKey: string | null = null;

	constructor(scriptContent: string) {
		this.apiKey = this.extractApiFromScript(scriptContent);
		this.searchUrl = this.extractSearchUrlScript(scriptContent, this.apiKey);

		if (BASE_URL.endsWith("/") && this.searchUrl?.startsWith("/")) {
			this.searchUrl = this.searchUrl.substring(1);
		}
	}

	private extractApiFromScript(scriptContent: string): string | null {
		// Test 1 - User ID API Key
		const userIdPattern = /users\s*:\s*{\s*id\s*:\s*"([^"]+)"/;
		const match = userIdPattern.exec(scriptContent);
		if (match?.[1]) {
			return match[1];
		}

		// Test 2 - Concatenated API Key associated with API fetch
		// Regex targets patterns like: fetch("/api/.../".concat("part1").concat("part2")...)
		// Or assignments like: var key = "/api/.../" + ".concat(...)"
		const concatApiKeyPattern =
			/fetch\("\/api\/\w+\/"\.concat\("([^"]+)"\)(?:\.concat\("([^"]+)"\))*\)/;
		const concatMatch = concatApiKeyPattern.exec(scriptContent);
		if (concatMatch) {
			const keyParts = concatMatch
				.slice(1)
				.filter((part) => part !== undefined);
			return keyParts.join("");
		}

		// Fallback: Search for .concat chains potentially assigned or used elsewhere
		const keyAssignmentPattern = /"\/api\/\w+\/"((?:\.concat\("[^"]*"\))+)/;
		const assignmentMatch = keyAssignmentPattern.exec(scriptContent);
		if (assignmentMatch?.[1]) {
			const concatPart = assignmentMatch[1];
			const parts = Array.from(concatPart.matchAll(/\.concat\("([^"]*)"\)/g));
			if (parts.length > 0) {
				return parts.map((p) => p[1]).join("");
			}
		}

		console.warn("Could not extract API key from script.");
		return null;
	}

	private extractSearchUrlScript(
		scriptContent: string,
		apiKey: string | null,
	): string | null {
		// Regex looks for fetch('/api/...') followed by .concat calls that match the previously extracted API key
		const pattern =
			/fetch\(\s*["'](\/api\/[^"']*)["']((?:\s*\.concat\(\s*["']([^"']*)["']\s*\))+)\s*,/g;
		const matches = Array.from(scriptContent.matchAll(pattern));

		for (const match of matches) {
			const endpoint = match[1];
			const concatCalls = match[2];

			const concatStringsPattern = /\.concat\(\s*["']([^"']*)["']\s*\)/g;
			const concatMatches = Array.from(
				concatCalls.matchAll(concatStringsPattern),
			);
			const concatenatedStr = concatMatches.map((m) => m[1]).join("");

			// Check if the dynamic key found here matches the one extracted earlier
			if (apiKey && concatenatedStr === apiKey) {
				return endpoint;
			}
		}
		console.warn("Could not extract dynamic search URL from script.");
		return null;
	}
}

function getSearchRequestHeaders(): HeadersInit {
	const ua =
		"Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/108.0.0.0 Safari/537.36";
	return {
		"content-type": "application/json",
		accept: "*/*",
		"User-Agent": ua,
		referer: REFERER_HEADER,
	};
}

function getTitleRequestHeaders(): HeadersInit {
	const ua =
		"Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/108.0.0.0 Safari/537.36";
	return {
		"User-Agent": ua,
		referer: REFERER_HEADER,
	};
}

function getSearchRequestData(
	gameName: string,
	searchModifiers: SearchModifiers,
	page: number,
	apiKey: string | null,
): string {
	const payload: SearchPayload = {
		searchType: "games",
		searchTerms: gameName.split(" "),
		searchPage: page,
		size: 20,
		searchOptions: {
			games: {
				userId: 0,
				platform: "",
				sortCategory: "popular",
				rangeCategory: "main",
				rangeTime: { min: 0, max: 0 },
				gameplay: { perspective: "", flow: "", genre: "", difficulty: "" },
				rangeYear: { max: "", min: "" },
				modifier: searchModifiers,
			},
			users: { sortCategory: "postcount" },
			lists: { sortCategory: "follows" },
			filter: "",
			sort: 0,
			randomizer: 0,
		},
		useCache: true,
	};

	if (apiKey) {
		if (!payload.searchOptions.users) {
			payload.searchOptions.users = { sortCategory: "postcount" };
		}
		payload.searchOptions.users.id = apiKey;
	}

	return JSON.stringify(payload);
}

async function fetchSearchInfo(
	parseAllScripts = false,
): Promise<SearchInformations | null> {
	const headers = getTitleRequestHeaders();
	try {
		const response = await fetch(BASE_URL, { headers });
		if (!response.ok) {
			console.error(`Failed to fetch base page: ${response.status}`);
			return null;
		}
		const html = await response.text();
		const $ = load(html);

		const scriptTags = $("script[src]");
		const scriptUrls: string[] = [];

		scriptTags.each((_, element) => {
			const src = $(element).attr("src");
			if (src) {
				if (parseAllScripts || src.includes("_app-")) {
					const fullUrl = new URL(src, BASE_URL).toString();
					scriptUrls.push(fullUrl);
				}
			}
		});

		for (const scriptUrl of scriptUrls) {
			try {
				const scriptResponse = await fetch(scriptUrl, { headers });
				if (scriptResponse.ok) {
					const scriptContent = await scriptResponse.text();
					const searchInfo = new SearchInformations(scriptContent);
					if (searchInfo.apiKey) {
						// Key is essential
						console.log(
							`Found API Key: ${searchInfo.apiKey}, Search URL: ${searchInfo.searchUrl ?? "(Not found/needed)"}`,
						);
						return searchInfo;
					}
				} else {
					console.warn(
						`Failed to fetch script ${scriptUrl}: ${scriptResponse.status}`,
					);
				}
			} catch (scriptError) {
				console.error(
					`Error fetching/processing script ${scriptUrl}:`,
					scriptError,
				);
			}
		}

		console.error("Could not find API key in any relevant script.");
		return null;
	} catch (error) {
		console.error("Error fetching HLTB page for API key extraction:", error);
		return null;
	}
}

function cutGameTitle(pageSource: string | null): string | null {
	if (!pageSource) return null;
	try {
		const $ = load(pageSource);
		const titleTag = $("title").first();
		const titleText = titleTag.text();
		// Extracts title based on "How long is [TITLE] | HowLongToBeat" pattern
		if (
			titleText &&
			titleText.length > 12 + 17 &&
			titleText.startsWith("How long is ") &&
			titleText.endsWith(" | HowLongToBeat")
		) {
			return titleText.substring(12, titleText.length - 17).trim();
		}
		console.warn("Title format might have changed:", titleText);
		return titleText?.trim() || null; // Fallback if format differs
	} catch (error) {
		console.error("Error parsing title tag:", error);
		return null;
	}
}

function getTitleRequestParams(gameId: number): URLSearchParams {
	return new URLSearchParams({ id: gameId.toString() });
}

export interface GameResult {
	game_id: number;
	game_name: string;
	game_alias: string;
	comp_main: number;
	comp_plus: number;
	comp_100: number;
	profile_platform: string;
}

interface SearchResults {
	color: string;
	title: string;
	category: string;
	count: number;
	pageCurrent: number;
	pageTotal: number;
	pageSize: number;
	data: GameResult[];
	userData: unknown[];
	displayModifier: string | null;
}

/**
 * Searches for a game on HowLongToBeat.
 * @param gameName The name of the game to search for.
 * @param searchModifiers Optional search modifiers.
 * @param page Optional page number.
 * @returns The raw response text (JSON string) or null if the request fails.
 */
export async function search(
	gameName: string,
	searchModifiers = SearchModifiers.NONE,
	page = 1,
): Promise<SearchResults | null> {
	if (!gameName || gameName.trim().length === 0) {
		return null;
	}
	let searchInfo = await fetchSearchInfo(false); // Try specific scripts first
	if (!searchInfo?.apiKey) {
		console.log("API Key not found in _app- scripts, trying all scripts...");
		searchInfo = await fetchSearchInfo(true); // Fallback: try all scripts
	}

	if (!searchInfo?.apiKey) {
		console.error("Failed to obtain API key. Cannot perform search.");
		return null;
	}

	const apiKey = searchInfo.apiKey;
	const searchUrlSuffix = searchInfo.searchUrl ?? FALLBACK_SEARCH_URL_SUFFIX;
	// Ensure BASE_URL and suffix combine correctly, avoiding double slashes
	const base = `${BASE_URL}${BASE_URL.endsWith("/") ? "" : "/"}`;
	const suffix = searchUrlSuffix.startsWith("/")
		? searchUrlSuffix.substring(1)
		: searchUrlSuffix;
	const baseSearchUrl = `${base}${suffix}`;

	const headers = getSearchRequestHeaders();

	// Attempt 1: API Key in URL
	const searchUrlWithKey = `${baseSearchUrl}${apiKey}`;
	console.log(`Attempting search POST to: ${searchUrlWithKey}`);
	const payloadForUrlKey = getSearchRequestData(
		gameName,
		searchModifiers,
		page,
		null,
	);

	try {
		const response = await fetch(searchUrlWithKey, {
			method: "POST",
			headers: headers,
			body: payloadForUrlKey,
		});
		if (response.ok) {
			console.log("Search successful (Key in URL).");
			const data = await response.json();
			return data as SearchResults;
		}
		console.warn(
			`Search with key in URL failed: ${response.status} ${response.statusText}`,
		);
	} catch (error) {
		console.error("Error during search (Key in URL):", error);
	}

	// Attempt 2: API Key in Payload
	console.log(`Attempting search POST to: ${baseSearchUrl} (Key in payload)`);
	const payloadForBodyKey = getSearchRequestData(
		gameName,
		searchModifiers,
		page,
		apiKey,
	);
	try {
		const response = await fetch(baseSearchUrl, {
			method: "POST",
			headers: headers,
			body: payloadForBodyKey,
		});
		if (response.ok) {
			console.log("Search successful (Key in Payload).");
			const data = await response.json();
			return data as SearchResults;
		}
		console.error(
			`Search with key in payload failed: ${response.status} ${response.statusText}`,
		);
		return null;
	} catch (error) {
		console.error("Error during search (Key in Payload):", error);
		return null;
	}
}

/**
 * Fetches the game page and extracts the title.
 * @param gameId The HowLongToBeat game ID.
 * @returns The game title string or null if an error occurs.
 */
export async function getGameTitle(gameId: number): Promise<string | null> {
	const params = getTitleRequestParams(gameId);
	const headers = getTitleRequestHeaders();
	const url = `${GAME_URL}?${params.toString()}`;

	console.log(`Fetching game title from: ${url}`);
	try {
		const response = await fetch(url, { headers });
		if (!response.ok) {
			console.error(`Failed to fetch game page ${gameId}: ${response.status}`);
			return null;
		}
		const html = await response.text();
		return cutGameTitle(html);
	} catch (error) {
		console.error(`Error fetching game title for ID ${gameId}:`, error);
		return null;
	}
}
