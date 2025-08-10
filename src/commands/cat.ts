import { EmbedBuilder, SlashCommandBuilder } from "discord.js";
import type { Command } from "~/commands";
import { COLORS } from "~/lib/constants";

interface CatAPIResponse {
	height: number;
	id: string;
	url: string;
	width: number;
}

async function fetchCatImage(): Promise<string> {
	const response = await fetch("https://api.thecatapi.com/v1/images/search");
	const [image] = (await response.json()) as CatAPIResponse[];
	return image.url;
}

export const CatCommand: Command = {
	name: "cat",
	description: "Get a random cat image",
	data: new SlashCommandBuilder()
		.setName("cat")
		.setDescription("Get a random cat image"),
	execute: async (interaction) => {
		await interaction.deferReply();

		try {
			const imageUrl = await fetchCatImage();

			await interaction.editReply({
				embeds: [
					new EmbedBuilder()
						.setColor(COLORS.PRIMARY)
						.setTitle("Random Cat!")
						.setImage(imageUrl)
						.setTimestamp(),
				],
			});
		} catch (error) {
			console.error("Error fetching cat image:", error);
			await interaction.editReply({
				embeds: [
					new EmbedBuilder()
						.setColor(COLORS.ERROR)
						.setTitle("Error")
						.setDescription(
							"An error occurred while fetching the cat image. Please try again later.",
						)
						.setTimestamp(),
				],
			});
		}
	},
};
