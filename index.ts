import {
	Client,
	GatewayIntentBits,
	SlashCommandBuilder,
	EmbedBuilder,
	type CommandInteraction,
	type CommandInteractionOptionResolver,
} from "discord.js";
import { config } from "dotenv";
import { HowLongToBeat } from "./src/features/hltb.ts";

config();

const client = new Client({ intents: [GatewayIntentBits.Guilds] });

const hltb = new HowLongToBeat();

client.once("ready", async () => {
	console.log(`Logged in as ${client.user?.tag}!`);

	const commands = [
		new SlashCommandBuilder()
			.setName("hltb")
			.setDescription("Get game completion times from HowLongToBeat")
			.addStringOption((option) =>
				option
					.setName("game")
					.setDescription("The name of the game to search for")
					.setRequired(true),
			)
			.toJSON(),
	];

	try {
		console.log("Registering commands...");
		await client.application?.commands.set(commands);
		console.log("Commands registered.");
	} catch (error) {
		console.error("Error registering commands:", error);
	}
});

client.on("interactionCreate", async (interaction) => {
	if (!interaction.isCommand()) return;

	const { commandName, options } = interaction as CommandInteraction & {
		options: CommandInteractionOptionResolver;
	};

	if (commandName === "hltb") {
		const gameName = options.getString("game", true);

		await interaction.deferReply();

		try {
			const searchResults = await hltb.search(gameName);

			if (searchResults.Results.length === 0) {
				const notFoundEmbed = new EmbedBuilder()
					.setColor(0xff0000)
					.setTitle("No Results Found")
					.setDescription(`No results found for "${gameName}"`);

				await interaction.editReply({ embeds: [notFoundEmbed] });
				return;
			}

			const game = searchResults.Results[0];

			const formatTime = (time: number | null): string => {
				if (time === null) return "N/A";
				return `${time} hours`;
			};

			const gameEmbed = new EmbedBuilder()
				.setColor(0x0099ff)
				.setTitle(game.name)
				.setURL(`https://howlongtobeat.com/game/${game.id}`)
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
	}
});

client.login(process.env.DISCORD_TOKEN);
