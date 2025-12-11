import type {
	ChatInputCommandInteraction,
	SlashCommandBuilder,
} from "discord.js";

export interface Command {
	name: string;
	description: string;
	execute: (interaction: ChatInputCommandInteraction) => Promise<void>;
	options?: (builder: SlashCommandBuilder) => SlashCommandBuilder;
}
