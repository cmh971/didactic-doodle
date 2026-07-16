// ============================================================================
// ONE BIG STARBOARD FILE — Reaction Handler + Slash Command + configureStarboard
// ============================================================================

import {
    SlashCommandBuilder,
    EmbedBuilder,
    PermissionFlagsBits
} from "discord.js";

// ============================================================================
// INTERNAL STARBOARD SETTINGS
// ============================================================================

let STAR_THRESHOLD = 3; // default
let SEND_IN_SAME_CHANNEL = true; // you said no channel ID

// ============================================================================
// ⭐ CONFIGURE STARBOARD (EXPORT #1)
// ============================================================================
// This is what your moderation command imports.

export function configureStarboard(options = {}) {
    if (typeof options.threshold === "number") {
        STAR_THRESHOLD = options.threshold;
    }

    if (typeof options.sameChannel === "boolean") {
        SEND_IN_SAME_CHANNEL = options.sameChannel;
    }

    return {
        threshold: STAR_THRESHOLD,
        sameChannel: SEND_IN_SAME_CHANNEL
    };
}

// ============================================================================
// ⭐ REACTION HANDLER (EXPORT #2)
// ============================================================================
// index.js:
// client.on("messageReactionAdd", (reaction, user) => handleStar(reaction, user));

export async function handleStar(reaction, user) {
    try {
        if (reaction.emoji.name !== "⭐") return;
        if (reaction.count < STAR_THRESHOLD) return;

        const message = reaction.message;

        // Send embed back into SAME channel (you requested this)
        const channel = message.channel;
        if (!channel) return;

        const embed = new EmbedBuilder()
            .setColor(0xffd700)
            .setTitle(`⭐ Starred Message (${reaction.count})`)
            .setDescription(message.content || "*No text content*")
            .addFields(
                { name: "Author", value: `<@${message.author.id}>`, inline: true },
                { name: "Channel", value: `<#${message.channel.id}>`, inline: true }
            )
            .setTimestamp(message.createdTimestamp);

        if (message.attachments.size > 0) {
            embed.setImage(message.attachments.first().url);
        }

        await channel.send({ embeds: [embed] });

    } catch (err) {
        console.error("Starboard Error:", err);
    }
}

// ============================================================================
// ⭐ SLASH COMMAND (EXPORT #3)
// ============================================================================

export const data = new SlashCommandBuilder()
    .setName("starboard")
    .setDescription("Starboard system")
    .addSubcommand(sub =>
        sub
            .setName("test")
            .setDescription("Send a test starboard message.")
    )
    .addSubcommand(sub =>
        sub
            .setName("config")
            .setDescription("Configure starboard settings.")
            .addIntegerOption(opt =>
                opt
                    .setName("threshold")
                    .setDescription("Stars required")
                    .setRequired(false)
            )
            .addBooleanOption(opt =>
                opt
                    .setName("samechannel")
                    .setDescription("Send starred messages in same channel")
                    .setRequired(false)
            )
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .setDMPermission(false);

// ============================================================================
// ⭐ EXECUTE HANDLER (EXPORT #4)
// ============================================================================

export async function execute(interaction) {
    const sub = interaction.options.getSubcommand();

    // /starboard test
    if (sub === "test") {
        const embed = new EmbedBuilder()
            .setColor(0xffd700)
            .setTitle("⭐ Starboard Test")
            .setDescription("Starboard command is working.")
            .setTimestamp(new Date());

        return interaction.reply({ embeds: [embed] });
    }

    // /starboard config
    if (sub === "config") {
        const threshold = interaction.options.getInteger("threshold");
        const sameChannel = interaction.options.getBoolean("samechannel");

        const newConfig = configureStarboard({
            threshold,
            sameChannel
        });

        const embed = new EmbedBuilder()
            .setColor(0x00ff99)
            .setTitle("⭐ Starboard Config Updated")
            .addFields(
                {
                    name: "Threshold",
                    value: `${newConfig.threshold}`,
                    inline: true
                },
                {
                    name: "Send In Same Channel",
                    value: `${newConfig.sameChannel}`,
                    inline: true
                }
            )
            .setTimestamp(new Date());

        return interaction.reply({ embeds: [embed] });
    }
}
