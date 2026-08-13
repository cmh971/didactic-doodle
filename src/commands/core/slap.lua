-- !slap [player]
local function run(args)
    local target = args[1] or "themselves"
    local items = {"a giant trout", "a pool noodle", "a soggy slice of pizza", "a rubber chicken"}
    math.randomseed(os.time())
    local item = items[math.random(1, #items)]
    print("🖐️ [ACTION] " .. target .. " got slapped with " .. item .. "!")
end

return run