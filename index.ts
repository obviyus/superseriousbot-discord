import {
	Client,
	GatewayIntentBits,
	Partials,
	REST,
	Routes,
	SlashCommandBuilder,
} from "discord.js";
import { CatCommand } from "~/commands/cat";
import { HowLongToBeatCommand } from "~/commands/hltb";

const discordToken = process.env.DISCORD_TOKEN;
if (!discordToken) throw new Error("Missing required env var: DISCORD_TOKEN");

const guildId = process.env.GUILD_ID;

const commands = [CatCommand, HowLongToBeatCommand];

const client = new Client({
	intents: [GatewayIntentBits.Guilds],
	partials: [Partials.Channel],
});

client.once("clientReady", async () => {
	console.log(`Logged in as ${client.user?.tag}!`);

	const commandData = commands.map((cmd) =>
		cmd.options
			? cmd
				.options(
					new SlashCommandBuilder()
						.setName(cmd.name)
						.setDescription(cmd.description),
				)
				.toJSON()
			: new SlashCommandBuilder()
				.setName(cmd.name)
				.setDescription(cmd.description)
				.toJSON(),
	);

	try {
		console.log("Registering commands...");
		const rest = new REST({ version: "10" }).setToken(discordToken);
		const appId = client.application?.id;
		if (!appId) throw new Error("client.application.id unavailable at ready");

		if (guildId) {
			await rest.put(Routes.applicationGuildCommands(appId, guildId), {
				body: commandData,
			});
			console.log(`Guild commands registered for guild ${guildId}.`);
		} else {
			await rest.put(Routes.applicationCommands(appId), { body: commandData });
			console.log("Global commands registered.");
		}
	} catch (error) {
		console.error("Error registering commands:", error);
	}
});

client.on("interactionCreate", async (interaction) => {
	if (!interaction.isChatInputCommand()) return;

	const command = commands.find((cmd) => cmd.name === interaction.commandName);
	if (!command) {
		await interaction.reply({ content: "Command not recognized!", ephemeral: true });
		return;
	}

	try {
		await command.execute(interaction);
	} catch (err) {
		console.error(`Command '${command.name}' failed:`, err);
		const content = "An error occurred while executing the command.";
		if (interaction.deferred || interaction.replied) {
			await interaction.editReply({ content });
		} else {
			await interaction.reply({ content, ephemeral: true });
		}
	}
});

client.login(discordToken);
