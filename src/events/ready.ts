import { SlashCommandBuilder, type Client } from "discord.js";
import { commands } from "../commands";

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
		await client.application?.commands.set(commandData);
		console.log("Commands registered.");
	} catch (error) {
		console.error("Error registering commands:", error);
	}
};
