import type { ChatInputCommandInteraction } from "discord.js";
import type { SlashCommandBuilder } from "discord.js";
import { HowLongToBeatCommand } from "~/commands/hltb";

export interface Command {
	name: string;
	description: string;
	execute: (interaction: ChatInputCommandInteraction) => Promise<void>;
	options?: (builder: SlashCommandBuilder) => SlashCommandBuilder;
}

export const commands: Command[] = [HowLongToBeatCommand];
