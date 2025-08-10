import { Client, GatewayIntentBits, Partials } from "discord.js";
import { interactionCreate } from "~/events/interactionCreate";
import { ready } from "~/events/ready";
import { AppConfig } from "~/lib/config";

const client = new Client({
	intents: [GatewayIntentBits.Guilds],
	partials: [Partials.Channel],
});

client.once("ready", () => ready(client));
interactionCreate(client);

client.login(AppConfig.discordToken);
