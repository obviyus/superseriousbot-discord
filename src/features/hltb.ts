const BASE_URL = "https://howlongtobeat.com/";
const REFERER_HEADER = BASE_URL;
const GAME_URL = `${BASE_URL}game`;
const AUTH_TOKEN_URL = `${BASE_URL}api/search/init`;
const FALLBACK_SEARCH_URL = `${BASE_URL}api/search`;

export enum SearchModifiers {
	NONE = "",
	ISOLATE_DLC = "only_dlc",
	ISOLATE_MODS = "only_mods",
	ISOLATE_HACKS = "only_hacks",
	HIDE_DLC = "hide_dlc",
}

// AIDEV-NOTE: User agents to rotate - helps avoid being blocked
const USER_AGENTS = [
	"Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
	"Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
	"Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:121.0) Gecko/20100101 Firefox/121.0",
	"Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.2 Safari/605.1.15",
];

function getRandomUserAgent(): string {
	return USER_AGENTS[Math.floor(Math.random() * USER_AGENTS.length)];
}

/**
 * Extracts the search URL from script content by finding POST fetch calls to /api/
 */
function extractSearchUrl(scriptContent: string): string | null {
	// Pattern matches: fetch("/api/something", { ... method: "POST" ... })
	const pattern =
		/fetch\s*\(\s*["']\/api\/([a-zA-Z0-9_/]+)[^"']*["']\s*,\s*\{[^}]*method:\s*["']POST["'][^}]*\}/gi;

	const match = pattern.exec(scriptContent);
	if (match) {
		const pathSuffix = match[1];
		// Get base path (e.g., "search" from "search/v2")
		const basePath = pathSuffix.includes("/")
			? pathSuffix.split("/")[0]
			: pathSuffix;

		// Skip "find" endpoint as it's not the search endpoint
		if (basePath !== "find") {
			return `/api/${basePath}`;
		}
	}

	return null;
}

/**
 * Fetches auth token from /api/search/init endpoint
 */
async function fetchAuthToken(): Promise<string | null> {
	const timestamp = Date.now();
	const url = `${AUTH_TOKEN_URL}?t=${timestamp}`;

	try {
		const response = await fetch(url, {
			headers: {
				"User-Agent": getRandomUserAgent(),
				referer: REFERER_HEADER,
			},
		});

		if (!response.ok) {
			console.error(`Failed to fetch auth token: ${response.status}`);
			return null;
		}

		const data = (await response.json()) as { token?: string };
		return data.token ?? null;
	} catch (error) {
		console.error("Error fetching auth token:", error);
		return null;
	}
}

/**
 * Fetches the search URL by parsing HLTB's JavaScript files
 */
async function fetchSearchUrl(): Promise<string> {
	const headers = {
		"User-Agent": getRandomUserAgent(),
		referer: REFERER_HEADER,
	};

	try {
		const response = await fetch(BASE_URL, { headers });
		if (!response.ok) {
			return FALLBACK_SEARCH_URL;
		}

		const html = await response.text();

		// Extract script src attributes using regex, prioritize _app- scripts
		const scriptPattern = /<script[^>]+src=["']([^"']+)["'][^>]*>/gi;
		const appScripts: string[] = [];
		const otherScripts: string[] = [];

		let match: RegExpExecArray | null;
		while ((match = scriptPattern.exec(html)) !== null) {
			const src = match[1];
			const fullUrl = new URL(src, BASE_URL).toString();
			if (src.includes("_app-")) {
				appScripts.push(fullUrl);
			} else {
				otherScripts.push(fullUrl);
			}
		}

		const scriptUrls = [...appScripts, ...otherScripts];

		for (const scriptUrl of scriptUrls) {
			try {
				const scriptResponse = await fetch(scriptUrl, { headers });
				if (scriptResponse.ok) {
					const scriptContent = await scriptResponse.text();
					const searchUrl = extractSearchUrl(scriptContent);
					if (searchUrl) {
						return `${BASE_URL}${searchUrl.replace(/^\//, "")}`;
					}
				}
			} catch {
				// Continue to next script
			}
		}
	} catch (error) {
		console.error("Error fetching search URL:", error);
	}

	return FALLBACK_SEARCH_URL;
}

function getSearchRequestHeaders(authToken: string | null): HeadersInit {
	const headers: HeadersInit = {
		"content-type": "application/json",
		accept: "*/*",
		"User-Agent": getRandomUserAgent(),
		referer: REFERER_HEADER,
	};

	if (authToken) {
		headers["x-auth-token"] = authToken;
	}

	return headers;
}

function getSearchRequestData(
	gameName: string,
	searchModifiers: SearchModifiers,
	page: number,
): string {
	return JSON.stringify({
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
	});
}

function cutGameTitle(pageSource: string | null): string | null {
	if (!pageSource) return null;

	// Extract title tag content using regex (handles attributes like data-next-head)
	const titleMatch = /<title[^>]*>([^<]*)<\/title>/i.exec(pageSource);
	if (!titleMatch) return null;

	const titleText = titleMatch[1];
	// Extracts title based on "How long is [TITLE]? | HowLongToBeat" pattern
	const hltbPattern = /^How long is (.+)\? \| HowLongToBeat$/;
	const match = hltbPattern.exec(titleText);
	if (match) {
		return match[1].trim();
	}

	return titleText.trim() || null;
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
 * @returns Search results or null if the request fails.
 */
export async function search(
	gameName: string,
	searchModifiers = SearchModifiers.NONE,
	page = 1,
): Promise<SearchResults | null> {
	if (!gameName || gameName.trim().length === 0) {
		return null;
	}

	// Fetch auth token and search URL in parallel
	const [authToken, searchUrl] = await Promise.all([
		fetchAuthToken(),
		fetchSearchUrl(),
	]);

	const headers = getSearchRequestHeaders(authToken);
	const payload = getSearchRequestData(gameName, searchModifiers, page);

	try {
		const response = await fetch(searchUrl, {
			method: "POST",
			headers,
			body: payload,
		});

		if (response.ok) {
			return (await response.json()) as SearchResults;
		}

		console.error(`Search failed: ${response.status} ${response.statusText}`);
		return null;
	} catch (error) {
		console.error("Error during search:", error);
		return null;
	}
}

/**
 * Fetches the game page and extracts the title.
 * @param gameId The HowLongToBeat game ID.
 * @returns The game title string or null if an error occurs.
 */
export async function getGameTitle(gameId: number): Promise<string | null> {
	const url = `${GAME_URL}?id=${gameId}`;

	try {
		const response = await fetch(url, {
			headers: {
				"User-Agent": getRandomUserAgent(),
				referer: REFERER_HEADER,
			},
		});

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
