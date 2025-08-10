import type { Client } from "discord.js";
import { commands } from "~/commands";

export const interactionCreate = async (client: Client) => {
	client.on("interactionCreate", async (interaction) => {
		if (!interaction.isChatInputCommand()) return;

		const command = commands.find(
			(cmd) => cmd.name === interaction.commandName,
		);

		if (!command) {
			await interaction.reply({
				content: "Command not recognized!",
				ephemeral: true,
			});
			return;
		}

		try {
			await command.execute(interaction);
		} catch (err) {
			console.error(`Command '${command.name}' failed:`, err);
			if (interaction.deferred || interaction.replied) {
				await interaction.editReply({
					content: "An error occurred while executing the command.",
				});
			} else {
				await interaction.reply({
					content: "An error occurred while executing the command.",
					ephemeral: true,
				});
			}
		}
	});
};
