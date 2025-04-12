import {
	ActionRowBuilder,
	StringSelectMenuBuilder,
	EmbedBuilder,
	type SlashCommandBuilder,
} from "discord.js";
import type { Command } from "~/commands";
import { search, type GameResult } from "~/features/hltb";

const COLORS = {
	ERROR: 0xff0000,
	PRIMARY: 0x0099ff,
} as const;

const MAX_RESULTS = 10;

function createGameEmbed(game: GameResult): EmbedBuilder {
	const formatTime = (time: number | null): string =>
		time === null ? "N/A" : `${Math.round(time / 3600)} hours`;

	return new EmbedBuilder()
		.setColor(COLORS.PRIMARY)
		.setTitle(game.game_name)
		.addFields(
			{
				name: "⚔️ Main Story",
				value: formatTime(game.comp_main),
				inline: true,
			},
			{
				name: "🎮 Main + Extras",
				value: formatTime(game.comp_plus),
				inline: true,
			},
			{
				name: "🏆 Completionist",
				value: formatTime(game.comp_100),
				inline: true,
			},
			{
				name: "📱 Platforms",
				value: game.profile_platform || "N/A",
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
				label: game.game_name,
				description:
					game.game_alias || game.profile_platform || "No additional info",
				value: game.game_id.toString(),
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
			const searchResults = await search(gameName);
			if (!searchResults?.data?.length) {
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

			const topResults = searchResults.data.slice(0, MAX_RESULTS);
			const reply = await interaction.editReply({
				embeds: [
					new EmbedBuilder()
						.setColor(COLORS.PRIMARY)
						.setTitle("Search Results")
						.setDescription("Choose a game from the dropdown below."),
				],
				components: [createGameSelector(topResults)],
			});

			const selection = await reply
				.awaitMessageComponent({
					filter: (i) => i.user.id === interaction.user.id,
					time: 15 * 60 * 1000,
				})
				.catch(() => null);

			if (selection?.isStringSelectMenu()) {
				const selectedGame = topResults.find(
					(game) => game.game_id.toString() === selection.values[0],
				);
				if (selectedGame) {
					await selection.update({
						embeds: [createGameEmbed(selectedGame)],
						components: [],
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
