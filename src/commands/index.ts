import type {
	ChatInputCommandInteraction,
	SlashCommandBuilder,
} from "discord.js";
import { CatCommand } from "~/commands/cat";
import { HowLongToBeatCommand } from "~/commands/hltb";

export interface Command {
	name: string;
	description: string;
	data?: SlashCommandBuilder;
	execute: (interaction: ChatInputCommandInteraction) => Promise<void>;
	options?: (builder: SlashCommandBuilder) => SlashCommandBuilder;
}

export const commands: Command[] = [HowLongToBeatCommand, CatCommand];
