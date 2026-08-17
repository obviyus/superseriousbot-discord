const BASE_URL = "https://howlongtobeat.com/";
const REFERER_HEADER = BASE_URL;

// AIDEV-NOTE: User agents to rotate - helps avoid being blocked by HLTB
const USER_AGENTS = [
	"Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
	"Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
	"Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:121.0) Gecko/20100101 Firefox/121.0",
	"Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.2 Safari/605.1.15",
];

function getRandomUserAgent(): string {
	return USER_AGENTS[Math.floor(Math.random() * USER_AGENTS.length)];
}

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === "object" && value !== null;
}

/**
 * Extracts the search URL from script content by finding POST fetch calls to /api/
 */
function extractSearchUrl(scriptContent: string): string | null {
	const pattern =
		/fetch\s*\(\s*["']\/api\/([a-zA-Z0-9_/]+)[^"']*["']\s*,\s*\{[^}]*method:\s*["']POST["'][^}]*\}/gi;

	const match = pattern.exec(scriptContent);
	if (match) {
		const pathSuffix = match[1];
		const basePath = pathSuffix.includes("/")
			? pathSuffix.split("/")[0]
			: pathSuffix;

		return `/api/${basePath}`;
	}

	return null;
}

interface SearchAuth {
	key: string;
	token: string;
	value: string;
}

function parseSearchAuth(value: unknown): SearchAuth | null {
	if (
		!isRecord(value) ||
		typeof value.token !== "string" ||
		typeof value.hpKey !== "string" ||
		typeof value.hpVal !== "string"
	) {
		return null;
	}

	return { key: value.hpKey, token: value.token, value: value.hpVal };
}

async function fetchSearchAuth(
	searchUrl: string,
	userAgent: string,
): Promise<SearchAuth | null> {
	const url = `${searchUrl.replace(/\/$/, "")}/init?t=${Date.now()}`;

	try {
		const response = await fetch(url, {
			headers: { "User-Agent": userAgent, referer: REFERER_HEADER },
		});

		if (!response.ok) {
			console.error(`Failed to fetch search auth: ${response.status}`);
			return null;
		}

		const auth = parseSearchAuth(await response.json());
		if (!auth) console.error("Invalid search auth response");
		return auth;
	} catch (error) {
		console.error("Error fetching search auth:", error);
		return null;
	}
}

// AIDEV-NOTE: HLTB has no public API - this scrapes their JS to find the dynamic search endpoint
async function fetchSearchUrl(userAgent: string): Promise<string | null> {
	const headers = {
		"User-Agent": userAgent,
		referer: REFERER_HEADER,
	};

	try {
		const response = await fetch(BASE_URL, { headers });
		if (!response.ok) return null;

		const html = await response.text();
		const scriptPattern = /<script[^>]+src=["']([^"']+)["'][^>]*>/gi;
		const appScripts: string[] = [];
		const otherScripts: string[] = [];

		for (
			let match = scriptPattern.exec(html);
			match !== null;
			match = scriptPattern.exec(html)
		) {
			const src = match[1];
			const fullUrl = new URL(src, BASE_URL).toString();
			if (src.includes("_app-")) {
				appScripts.push(fullUrl);
			} else {
				otherScripts.push(fullUrl);
			}
		}

		for (const scriptUrl of [...appScripts, ...otherScripts]) {
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

	return null;
}

function getSearchRequestData(
	gameName: string,
	page: number,
	auth: SearchAuth,
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
				modifier: "",
			},
			users: { sortCategory: "postcount" },
			lists: { sortCategory: "follows" },
			filter: "",
			sort: 0,
			randomizer: 0,
		},
		useCache: true,
		[auth.key]: auth.value,
	});
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
	data: GameResult[];
}

function isGameResult(value: unknown): value is GameResult {
	return (
		isRecord(value) &&
		typeof value.game_id === "number" &&
		typeof value.game_name === "string" &&
		typeof value.game_alias === "string" &&
		typeof value.comp_main === "number" &&
		typeof value.comp_plus === "number" &&
		typeof value.comp_100 === "number" &&
		typeof value.profile_platform === "string"
	);
}

function parseSearchResults(value: unknown): SearchResults | null {
	if (!isRecord(value) || !Array.isArray(value.data)) return null;
	if (!value.data.every(isGameResult)) return null;
	return { data: value.data };
}

export async function search(
	gameName: string,
	page = 1,
): Promise<SearchResults | null> {
	if (!gameName?.trim()) return null;

	const userAgent = getRandomUserAgent();
	const searchUrl = await fetchSearchUrl(userAgent);
	if (!searchUrl) return null;

	const auth = await fetchSearchAuth(searchUrl, userAgent);
	if (!auth) return null;

	const headers: HeadersInit = {
		"content-type": "application/json",
		accept: "*/*",
		"User-Agent": userAgent,
		referer: REFERER_HEADER,
		Origin: REFERER_HEADER,
		"x-auth-token": auth.token,
		"x-hp-key": auth.key,
		"x-hp-val": auth.value,
	};

	try {
		const response = await fetch(searchUrl, {
			method: "POST",
			headers,
			body: getSearchRequestData(gameName, page, auth),
		});

		if (response.ok) {
			const results = parseSearchResults(await response.json());
			if (!results) console.error("Invalid search response");
			return results;
		}

		console.error(`Search failed: ${response.status} ${response.statusText}`);
		return null;
	} catch (error) {
		console.error("Error during search:", error);
		return null;
	}
}
