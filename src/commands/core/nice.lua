-- ============================================================================
-- howcool.lua — A simple command that calculates and displays coolness
-- ============================================================================

local function checkCoolness(username)
    -- Default to "Friend" if no name is provided
    username = username or "Cool Friend"

    -- Generate a consistent "cool score" based on name length & randomness
    math.randomseed(os.time())
    local score = math.random(85, 100)

    -- Determine a title based on score bc we have to
    local title = "Pretty Cool"
    if score >= 98 then
        title = "Absolute Legend"
    elseif score >= 95 then
        title = "Ultra Awesome"
    elseif score >= 90 then
        title = "Super duper Cool"
    end

    -- Print out the result to it
    print("----------------------------------------")
    print("       COOLNESS METER RESULTS!!!! 😁😄😃😀😄          ")
    print("----------------------------------------")
    print(" User: " .. username)
    print(" Rating: " .. tostring(score) .. "/100")
    print(" Status: " .. title)
    print(" Summary: 100% certified super duper  cool!")
    print("----------------------------------------")

    -- Return as a table so other scripts can read the values
    return {
        username = username,
        score = score,
        title = title -- end
    }
end

-- example usage for testing yk yk
checkCoolness("Player1")