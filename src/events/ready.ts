import { type Client, REST, Routes, SlashCommandBuilder } from "discord.js";
import { commands } from "~/commands";
import { AppConfig } from "~/lib/config";

export const ready = async (client: Client) => {
	console.log(`Logged in as ${client.user?.tag}!`);

	const commandData = commands.map((cmd) => {
		const builder = new SlashCommandBuilder()
			.setName(cmd.name)
			.setDescription(cmd.description);
		return cmd.options ? cmd.options(builder).toJSON() : builder.toJSON();
	});

	try {
		console.log("Registering commands...");
		const rest = new REST({ version: "10" }).setToken(AppConfig.discordToken);

		const appId = client.application?.id;
		if (!appId) throw new Error("client.application.id unavailable at ready");

		if (AppConfig.guildId) {
			await rest.put(
				Routes.applicationGuildCommands(appId, AppConfig.guildId),
				{ body: commandData },
			);
			console.log(`Guild commands registered for guild ${AppConfig.guildId}.`);
		} else {
			await rest.put(Routes.applicationCommands(appId), {
				body: commandData,
			});
			console.log("Global commands registered.");
		}
	} catch (error) {
		console.error("Error registering commands:", error);
	}
};
