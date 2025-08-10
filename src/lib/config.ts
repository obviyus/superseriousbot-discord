import { config as dotenvConfig } from "dotenv";

dotenvConfig();

function getEnv(
	name: string,
	options?: { required?: boolean },
): string | undefined {
	const value = process.env[name];
	if (options?.required && (!value || value.length === 0)) {
		throw new Error(`Missing required env var: ${name}`);
	}
	return value;
}

export const AppConfig = {
	discordToken: getEnv("DISCORD_TOKEN", { required: true }) as string,
	// Optional: scope command registration to a single guild during development for faster updates
	// Provide GUILD_ID to use guild-scoped commands; otherwise uses global
	guildId: getEnv("GUILD_ID"),
} as const;
