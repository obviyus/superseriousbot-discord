import { EmbedBuilder, type SlashCommandBuilder } from "discord.js";
import { HowLongToBeat } from "~/features/hltb";
import type { Command } from "~/commands";

const hltb = new HowLongToBeat();

export const HowLongToBeatCommand: Command = {
	name: "hltb",
	description: "Get game completion times from HowLongToBeat",
	options: (builder) =>
		builder.addStringOption((option) =>
			option
				.setName("game")
				.setDescription("The name of the game to search for")
				.setRequired(true),
		) as SlashCommandBuilder,
	execute: async (interaction) => {
		const options = interaction.options;
		const gameName = options.getString("game", true);

		await interaction.deferReply();

		try {
			// Use the HowLongToBeat class to fetch search results
			const searchResults = await hltb.search(gameName);

			// Handle case where no results are found
			if (searchResults.Results.length === 0) {
				const notFoundEmbed = new EmbedBuilder()
					.setColor(0xff0000)
					.setTitle("No Results Found")
					.setDescription(`No results found for "${gameName}"`);

				await interaction.editReply({ embeds: [notFoundEmbed] });
				return;
			}

			// Process the first game result
			const game = searchResults.Results[0];

			// Helper function to format time
			const formatTime = (time: number | null): string => {
				if (time === null) return "N/A";
				return `${time} hours`;
			};

			// Create and send the embed
			const gameEmbed = new EmbedBuilder()
				.setColor(0x0099ff)
				.setTitle(game.name)
				.addFields(
					{
						name: "⚔️ Main Story",
						value: formatTime(game.mainStory),
						inline: true,
					},
					{
						name: "🎮 Main + Extras",
						value: formatTime(game.extras),
						inline: true,
					},
					{
						name: "🏆 Completionist",
						value: formatTime(game.completionist),
						inline: true,
					},
					{
						name: "📱 Platforms",
						value: game.platforms.length ? game.platforms.join(", ") : "N/A",
						inline: false,
					},
				)
				.setTimestamp();

			await interaction.editReply({ embeds: [gameEmbed] });
		} catch (error) {
			console.error("Error fetching game data:", error);

			// Handle errors gracefully with an error embed
			const errorEmbed = new EmbedBuilder()
				.setColor(0xff0000)
				.setTitle("Error")
				.setDescription(
					"An error occurred while fetching game data. Please try again later.",
				)
				.setTimestamp()
				.setFooter({ text: "Powered by HowLongToBeat" });

			await interaction.editReply({ embeds: [errorEmbed] });
		}
	},
};
