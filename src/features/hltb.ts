const BASE_URL = "https://howlongtobeat.com/";
const REFERER_HEADER = BASE_URL;
const AUTH_TOKEN_URL = `${BASE_URL}api/search/init`;
const FALLBACK_SEARCH_URL = `${BASE_URL}api/search`;

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

		if (basePath !== "find") {
			return `/api/${basePath}`;
		}
	}

	return null;
}

async function fetchAuthToken(): Promise<string | null> {
	const url = `${AUTH_TOKEN_URL}?t=${Date.now()}`;

	try {
		const response = await fetch(url, {
			headers: { "User-Agent": getRandomUserAgent(), referer: REFERER_HEADER },
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

// AIDEV-NOTE: HLTB has no public API - this scrapes their JS to find the dynamic search endpoint
async function fetchSearchUrl(): Promise<string> {
	const headers = {
		"User-Agent": getRandomUserAgent(),
		referer: REFERER_HEADER,
	};

	try {
		const response = await fetch(BASE_URL, { headers });
		if (!response.ok) return FALLBACK_SEARCH_URL;

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

	return FALLBACK_SEARCH_URL;
}

function getSearchRequestData(gameName: string, page: number): string {
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

export async function search(
	gameName: string,
	page = 1,
): Promise<SearchResults | null> {
	if (!gameName?.trim()) return null;

	const [authToken, searchUrl] = await Promise.all([
		fetchAuthToken(),
		fetchSearchUrl(),
	]);

	const headers: HeadersInit = {
		"content-type": "application/json",
		accept: "*/*",
		"User-Agent": getRandomUserAgent(),
		referer: REFERER_HEADER,
	};
	if (authToken) headers["x-auth-token"] = authToken;

	try {
		const response = await fetch(searchUrl, {
			method: "POST",
			headers,
			body: getSearchRequestData(gameName, page),
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
