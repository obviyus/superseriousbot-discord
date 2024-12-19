import { load } from "cheerio";

enum SearchModifiers {
	NONE = "",
	ISOLATE_DLC = "only_dlc",
	ISOLATE_MODS = "only_mods",
	ISOLATE_HACKS = "only_hacks",
	HIDE_DLC = "hide_dlc",
}

export interface GameResult {
	id: string;
	name: string;
	mainStory: number | null;
	extras: number | null;
	completionist: number | null;
	platforms: string[];
}

interface SearchResponse {
	Results: GameResult[];
	Pagination: {
		TotalResults: number;
		CurrentPage: number;
		LastPage: number;
	};
}

class HowLongToBeat {
	private static readonly BASE_URL = "https://howlongtobeat.com";
	private static readonly REFERER_HEADER = HowLongToBeat.BASE_URL;
	private static readonly SEARCH_URL = `${HowLongToBeat.BASE_URL}/api/find`;
	private static readonly GAME_URL = `${HowLongToBeat.BASE_URL}/game`;

	private static readonly API_KEY_CACHE: {
		key: string | null;
		timestamp: number | null;
	} = {
		key: null,
		timestamp: null,
	};

	private static readonly CACHE_DURATION = 24 * 60 * 60 * 1000; // 24 hours

	private isApiKeyExpired(): boolean {
		const { key, timestamp } = HowLongToBeat.API_KEY_CACHE;
		if (!key || !timestamp) return true;
		return Date.now() - timestamp > HowLongToBeat.CACHE_DURATION;
	}

	private async refreshApiKey(): Promise<void> {
		const newKey =
			(await this.fetchApiKey(false)) || (await this.fetchApiKey(true));
		HowLongToBeat.API_KEY_CACHE.key = newKey;
		HowLongToBeat.API_KEY_CACHE.timestamp = Date.now();
	}

	private get apiKey(): string | null {
		return HowLongToBeat.API_KEY_CACHE.key;
	}

	private getHeaders(): HeadersInit {
		return {
			"content-type": "application/json",
			accept: "*/*",
			"User-Agent": "superseriousbot-discord",
			referer: HowLongToBeat.REFERER_HEADER,
		};
	}

	private convertMinutesToHours(minutes: number | null): number | null {
		if (minutes === null || minutes === undefined) return null;
		return Number((minutes / 60 / 60).toFixed(1));
	}

	private getSearchRequestData(
		gameName: string,
		searchModifiers: SearchModifiers = SearchModifiers.NONE,
		page = 1,
	): string {
		const payload = {
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
					rangeTime: {
						min: 0,
						max: 0,
					},
					gameplay: {
						perspective: "",
						flow: "",
						genre: "",
						difficulty: "",
					},
					rangeYear: {
						max: "",
						min: "",
					},
					modifier: searchModifiers,
				},
				users: {
					sortCategory: "postcount",
					id: "",
				},
				lists: {
					sortCategory: "follows",
				},
				filter: "",
				sort: 0,
				randomizer: 0,
			},
			useCache: true,
		};

		if (this.apiKey) {
			payload.searchOptions.users.id = this.apiKey;
		}

		return JSON.stringify(payload);
	}

	private async extractApiFromScript(
		scriptContent: string,
	): Promise<string | null> {
		const userIdPattern = /users\s*:\s*{\s*id\s*:\s*"([^"]+)"/;
		const userIdMatch = userIdPattern.exec(scriptContent);
		if (userIdMatch) {
			return userIdMatch[1];
		}

		const concatApiKeyPattern = /\/api\/find\/"(?:\.concat\("[^"]*"\))*/;
		const concatMatch = concatApiKeyPattern.exec(scriptContent);
		if (concatMatch) {
			const matches = concatMatch[0].split(".concat");
			const key = matches
				.slice(1)
				.map((match) => match.replace(/["\(\)\[\]\']/g, ""))
				.join("");
			return key;
		}

		return null;
	}

	private async fetchApiKey(parseAllScripts = false): Promise<string | null> {
		try {
			const headers = this.getHeaders();
			const response = await fetch(HowLongToBeat.BASE_URL, { headers });
			const html = await response.text();
			const $ = load(html);

			const scripts = $("script[src]")
				.map((_, script) => $(script).attr("src"))
				.get()
				.filter((src) => parseAllScripts || src?.includes("_app-"));

			for (const scriptSrc of scripts) {
				if (!scriptSrc) continue;

				const scriptUrl = new URL(scriptSrc, HowLongToBeat.BASE_URL).toString();
				const scriptResponse = await fetch(scriptUrl, { headers });
				const scriptContent = await scriptResponse.text();

				const apiKey = await this.extractApiFromScript(scriptContent);
				if (apiKey) {
					HowLongToBeat.API_KEY_CACHE.key = apiKey;
					return apiKey;
				}
			}
		} catch (error) {
			console.error("Failed to fetch API key:", error);
		}
		return null;
	}

	private parsePlatforms(platformString: string): string[] {
		if (!platformString) return [];
		return platformString
			.split(",")
			.map((p) => p.trim())
			.filter((p) => p.length > 0);
	}

	private formatSearchResults(data: {
		data: {
			game_id: string;
			game_name: string;
			comp_main: number | null;
			comp_plus: number | null;
			comp_100: number | null;
			profile_platform: string;
		}[];
		count: number;
		searchPage: number;
		pageTotal: number;
	}): SearchResponse {
		return {
			Results: data.data.map(
				(game: {
					game_id: string;
					game_name: string;
					comp_main: number | null;
					comp_plus: number | null;
					comp_100: number | null;
					profile_platform: string;
				}) => ({
					id: game.game_id,
					name: game.game_name,
					mainStory: this.convertMinutesToHours(game.comp_main),
					extras: this.convertMinutesToHours(game.comp_plus),
					completionist: this.convertMinutesToHours(game.comp_100),
					platforms: this.parsePlatforms(game.profile_platform),
				}),
			),
			Pagination: {
				TotalResults: data.count,
				CurrentPage: data.searchPage,
				LastPage: data.pageTotal,
			},
		};
	}

	public async search(
		gameName: string,
		searchModifiers: SearchModifiers = SearchModifiers.NONE,
		page = 1,
	): Promise<SearchResponse> {
		if (!this.apiKey || this.isApiKeyExpired()) {
			await this.refreshApiKey();
		}

		const headers = this.getHeaders();
		const payload = this.getSearchRequestData(gameName, searchModifiers, page);

		// Try with API key in URL first
		try {
			const response = await fetch(
				`${HowLongToBeat.SEARCH_URL}/${this.apiKey}`,
				{
					method: "POST",
					headers,
					body: payload,
				},
			);

			if (response.status === 404) {
				// If 404, refresh token and retry
				await this.refreshApiKey();
				return await this.search(gameName, searchModifiers, page);
			}

			if (response.ok) {
				const data = await response.json();
				return this.formatSearchResults(data);
			}
		} catch (error) {
			console.error("Search with URL API key failed:", error);
		}

		// Try with API key in payload
		try {
			const response = await fetch(HowLongToBeat.SEARCH_URL, {
				method: "POST",
				headers,
				body: payload,
			});

			if (response.ok) {
				const data = await response.json();
				return this.formatSearchResults(data);
			}
		} catch (error) {
			console.error("Search with payload API key failed:", error);
			throw error;
		}

		throw new Error("Search failed");
	}

	public async getGameTitle(gameId: number): Promise<string | null> {
		try {
			const params = new URLSearchParams({ id: gameId.toString() });
			const headers = this.getHeaders();

			const response = await fetch(`${HowLongToBeat.GAME_URL}?${params}`, {
				headers,
			});
			const html = await response.text();

			const $ = load(html);
			const titleText = $("title").text();

			if (!titleText) return null;

			return titleText.substring(12, titleText.length - 17).trim();
		} catch (error) {
			console.error("Failed to get game title:", error);
			return null;
		}
	}
}

export { HowLongToBeat };
