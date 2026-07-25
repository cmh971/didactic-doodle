--!strict
-- Sentinel — Roblox → Discord webhook bridge (Luau).
--
-- Drop this ModuleScript into a Roblox experience (e.g. a server-side Script in
-- ServerScriptService) to push in-game events — player joins, reports, session
-- milestones — into a Discord channel as clean embeds. This is the authentic
-- home for Luau in this project: it runs INSIDE Roblox, alongside your ER:LC-
-- style roleplay servers.
--
-- IMPORTANT (real-world gotcha): Discord blocks direct webhook requests coming
-- from Roblox servers, so you must point PROXY_URL at a webhook proxy that
-- forwards to your real Discord webhook (self-host one, or use a public proxy
-- such as hooks.hyra.io). Put your Discord webhook URL's path into the proxy.
--
-- Setup:
--   1. Game Settings → Security → enable "Allow HTTP Requests".
--   2. Set PROXY_URL below to your webhook proxy endpoint.
--   3. require() this module and call DiscordWebhook.send{...}.

local HttpService = game:GetService("HttpService")
local Players = game:GetService("Players")

local DiscordWebhook = {}

-- Your webhook proxy endpoint (NOT the raw discord.com URL — Roblox is blocked).
DiscordWebhook.PROXY_URL = "https://YOUR-WEBHOOK-PROXY.example/api/webhooks/xxxxx/yyyyy"

export type Field = { name: string, value: string, inline: boolean? }
export type Embed = {
	title: string?,
	description: string?,
	color: number?,
	fields: { Field }?,
}

-- Build a Discord embed table. color is a decimal int (e.g. 0x2ECC71 = 3066993).
function DiscordWebhook.embed(title: string, description: string, color: number?): Embed
	return {
		title = title,
		description = description,
		color = color or 0x5865F2,
		fields = {},
	}
end

-- Fire-and-forget POST to the proxy. Runs in a pcall so a failed request never
-- breaks game logic; returns true on success.
function DiscordWebhook.send(payload: { content: string?, embeds: { Embed }? }): boolean
	if DiscordWebhook.PROXY_URL:find("YOUR%-WEBHOOK%-PROXY") then
		warn("[DiscordWebhook] PROXY_URL is not configured yet.")
		return false
	end
	local body = HttpService:JSONEncode(payload)
	local ok, err = pcall(function()
		HttpService:PostAsync(DiscordWebhook.PROXY_URL, body, Enum.HttpContentType.ApplicationJson)
	end)
	if not ok then
		warn("[DiscordWebhook] send failed: " .. tostring(err))
	end
	return ok
end

-- Convenience: announce a player joining, with their name and the live count.
function DiscordWebhook.playerJoined(player: Player)
	local e = DiscordWebhook.embed(
		"🟢 Player joined",
		string.format("**%s** joined — now **%d** in-server.", player.Name, #Players:GetPlayers()),
		0x2ECC71
	)
	DiscordWebhook.send({ embeds = { e } })
end

-- Example wiring (uncomment in a server Script):
-- Players.PlayerAdded:Connect(function(player)
-- 	DiscordWebhook.playerJoined(player)
-- end)

return DiscordWebhook
