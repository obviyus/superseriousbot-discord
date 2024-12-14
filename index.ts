import { Client, GatewayIntentBits } from "discord.js";
import { config } from "dotenv";
import { ready } from "~/events/ready";
import { interactionCreate } from "~/events/interactionCreate";

config();

const client = new Client({ intents: [GatewayIntentBits.Guilds] });

client.once("ready", () => ready(client));
interactionCreate(client);

client.login(process.env.DISCORD_TOKEN);
