import type { Client } from "discord.js";
import { commands } from "../commands";

export const interactionCreate = async (client: Client) => {
	client.on("interactionCreate", async (interaction) => {
		if (!interaction.isCommand()) return;

		const command = commands.find(
			(cmd) => cmd.name === interaction.commandName,
		);

		if (command) {
			await command.execute(interaction);
		} else {
			await interaction.reply({
				content: "Command not recognized!",
				ephemeral: true,
			});
		}
	});
};
