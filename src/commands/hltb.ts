import {
	ActionRowBuilder,
	StringSelectMenuBuilder,
	EmbedBuilder,
	type SlashCommandBuilder,
} from "discord.js";
import { HowLongToBeat, type GameResult } from "~/features/hltb";
import type { Command } from "~/commands";

const COLORS = {
	ERROR: 0xff0000,
	PRIMARY: 0x0099ff,
} as const;

const MAX_RESULTS = 10;
const hltb = new HowLongToBeat();

function createGameEmbed(game: GameResult): EmbedBuilder {
	const formatTime = (time: number | null): string =>
		time === null ? "N/A" : `${time} hours`;

	return new EmbedBuilder()
		.setColor(COLORS.PRIMARY)
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
}

function createGameSelector(
	games: GameResult[],
): ActionRowBuilder<StringSelectMenuBuilder> {
	const selectMenu = new StringSelectMenuBuilder()
		.setCustomId("select_game")
		.setPlaceholder("Choose a game")
		.addOptions(
			games.map((game) => ({
				label: game.name,
				description: game.platforms.join(", ") || "No platforms listed",
				value: game.id.toString(),
			})),
		);

	return new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(
		selectMenu,
	);
}

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
		await interaction.deferReply();
		const gameName = interaction.options.getString("game", true);

		try {
			const searchResults = await hltb.search(gameName);

			if (searchResults.Results.length === 0) {
				await interaction.editReply({
					embeds: [
						new EmbedBuilder()
							.setColor(COLORS.ERROR)
							.setTitle("No Results Found")
							.setDescription(`No results found for "${gameName}"`),
					],
				});
				return;
			}

			const topResults = searchResults.Results.slice(0, MAX_RESULTS);
			const reply = await interaction.editReply({
				embeds: [
					new EmbedBuilder()
						.setColor(COLORS.PRIMARY)
						.setTitle("Search Results")
						.setDescription("Choose a game from the dropdown below."),
				],
				components: [createGameSelector(topResults)],
			});

			// Single collector with auto-cleanup
			const selection = await reply
				.awaitMessageComponent({
					filter: (i) => i.user.id === interaction.user.id,
					// Component will auto-invalidate after 15 minutes anyway
					time: 15 * 60 * 1000,
				})
				.catch(() => null);

			if (selection?.isStringSelectMenu()) {
				const selectedGame = topResults.find(
					(game) => game.id.toString() === selection.values[0],
				);
				if (selectedGame) {
					await selection.update({
						embeds: [createGameEmbed(selectedGame)],
						components: [], // Remove the select menu
					});
				}
			}
		} catch (error) {
			console.error("Error fetching game data:", error);
			await interaction.editReply({
				embeds: [
					new EmbedBuilder()
						.setColor(COLORS.ERROR)
						.setTitle("Error")
						.setDescription(
							"An error occurred while fetching game data. Please try again later.",
						)
						.setTimestamp(),
				],
			});
		}
	},
};
