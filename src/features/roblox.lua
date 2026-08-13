-- ============================================================================
-- roblox.lua — Roblox API wrapper for Sentinel
-- This script uses the host __http function to get data from Roblox.
-- ============================================================================

-- Simple JSON decoder and encoder library
local json = {}

-- Function to remove space, tab, and enter characters from string
local function skip_spaces(text, index)
    while index <= #text do
        local character = text:sub(index, index)
        if character == " " or character == "\t" or character == "\n" or character == "\r" then
            index = index + 1
        else
            break
        end
    end
    return index
end

-- Helper function to decode strings inside JSON
local function decode_json_string(text, index)
    local result = ""
    local i = index + 1 -- skip opening quote

    while i <= #text do
        local char = text:sub(i, i)

        if char == '"' then
            -- Found end of string
            return result, i + 1
        elseif char == "\\" then
            -- Handle simple escape characters
            local next_char = text:sub(i + 1, i + 1)
            if next_char == "n" then
                result = result .. "\n"
            elseif next_char == "t" then
                result = result .. "\t"
            elseif next_char == "r" then
                result = result .. "\r"
            else
                result = result .. next_char
            end
            i = i + 2
        else
            result = result .. char
            i = i + 1
        end
    end

    error("JSON error: string was not closed with quotes!")
end

-- Helper function to decode numbers
local function decode_json_number(text, index)
    local number_string = ""
    while index <= #text do
        local char = text:sub(index, index)
        if char:find("[0-9%.%-]") then
            number_string = number_string .. char
            index = index + 1
        else
            break
        end
    end
    return tonumber(number_string), index
end

-- Forward declaration so functions can call it recursively
local decode_value

-- Decode a JSON array [...]
local function decode_json_array(text, index)
    local my_array = {}
    index = skip_spaces(text, index + 1) -- Skip [

    if text:sub(index, index) == "]" then
        return my_array, index + 1
    end

    while index <= #text do
        local val
        val, index = decode_value(text, index)
        table.insert(my_array, val)

        index = skip_spaces(text, index)
        local char = text:sub(index, index)

        if char == "]" then
            return my_array, index + 1
        elseif char == "," then
            index = skip_spaces(text, index + 1)
        end
    end
end

-- Decode a JSON object {...}
local function decode_json_object(text, index)
    local my_object = {}
    index = skip_spaces(text, index + 1) -- Skip {

    if text:sub(index, index) == "}" then
        return my_object, index + 1
    end

    while index <= #text do
        local key
        key, index = decode_json_string(text, index)

        index = skip_spaces(text, index)
        if text:sub(index, index) == ":" then
            index = skip_spaces(text, index + 1)
        end

        local val
        val, index = decode_value(text, index)
        my_object[key] = val

        index = skip_spaces(text, index)
        local char = text:sub(index, index)

        if char == "}" then
            return my_object, index + 1
        elseif char == "," then
            index = skip_spaces(text, index + 1)
        end
    end
end

-- Main value decoder
decode_value = function(text, index)
    index = skip_spaces(text, index)
    local first_char = text:sub(index, index)

    if first_char == '"' then
        return decode_json_string(text, index)
    elseif first_char == "{" then
        return decode_json_object(text, index)
    elseif first_char == "[" then
        return decode_json_array(text, index)
    elseif first_char == "t" then
        return true, index + 4
    elseif first_char == "f" then
        return false, index + 5
    elseif first_char == "n" then
        return nil, index + 4
    else
        return decode_json_number(text, index)
    end
end

-- Main JSON decode function
function json.decode(text)
    if text == nil or text == "" then
        return nil
    end

    local success, result = pcall(function()
        local decoded, _ = decode_value(text, 1)
        return decoded
    end)

    if success then
        return result
    else
        return nil
    end
end

-- Main JSON encode function
function json.encode(val)
    local val_type = type(val)

    if val_type == "string" then
        return '"' .. val .. '"'
    elseif val_type == "number" or val_type == "boolean" then
        return tostring(val)
    elseif val_type == "table" then
        -- Check if table is an array or an object
        local is_array = true
        local count = 0

        for key, value in pairs(val) do
            count = count + 1
            if type(key) ~= "number" then
                is_array = false
            end
        end

        if count == 0 then
            return "{}"
        end

        if is_array then
            local parts = {}
            for i = 1, #val do
                table.insert(parts, json.encode(val[i]))
            end
            return "[" .. table.concat(parts, ",") .. "]"
        else
            local parts = {}
            for k, v in pairs(val) do
                table.insert(parts, '"' .. tostring(k) .. '":' .. json.encode(v))
            end
            return "{" .. table.concat(parts, ",") .. "}"
        end
    else
        return "null"
    end
end

-- ============================================================================
-- Roblox API Functions
-- ============================================================================

local roblox = {}
roblox.json = json

-- Base URLs for API calls
local USERS_URL = "https://users.roblox.com"
local THUMBNAILS_URL = "https://thumbnails.roblox.com"
local GROUPS_URL = "https://groups.roblox.com"

-- Helper function to make HTTP requests
local function make_request(url, method, body)
    -- Call the global host function injected by Sentinel
    local promise = __http(url, method, body)

    -- Resolve promise if returned (accepts both table and userdata bindings)
    if (type(promise) == "table" or type(promise) == "userdata") and promise.await then
        return promise:await()
    end

    return promise
end

-- Get User ID from Username
function roblox.getUserId(username)
    local url = USERS_URL .. "/v1/usernames/users"
    local request_data = {
        usernames = { username },
        excludeBannedUsers = false
    }

    local response = make_request(url, "POST", json.encode(request_data))
    local data = json.decode(response)

    if data and data.data and data.data[1] then
        local user_info = data.data[1]
        return user_info.id, user_info.name, user_info.displayName
    end

    return nil
end

-- Get Full User Info from User ID
function roblox.getUser(id)
    local url = USERS_URL .. "/v1/users/" .. tostring(id)
    local response = make_request(url, "GET", nil)
    return json.decode(response)
end

-- Get Profile Description
function roblox.getDescription(id)
    local user = roblox.getUser(id)
    if user then
        return user.description
    end
    return nil
end

-- Get User Avatar Headshot
function roblox.getAvatar(id)
    local url = THUMBNAILS_URL .. "/v1/users/avatar-headshot?userIds=" .. tostring(id) .. "&size=150x150&format=Png&isCircular=false"
    local response = make_request(url, "GET", nil)
    local data = json.decode(response)

    if data and data.data and data.data[1] then
        return data.data[1].imageUrl
    end

    return nil
end

-- Get Rank in Group
function roblox.getGroupRank(userId, groupId)
    local url = GROUPS_URL .. "/v2/users/" .. tostring(userId) .. "/groups/roles"
    local response = make_request(url, "GET", nil)
    local data = json.decode(response)

    if data and data.data then
        for i = 1, #data.data do
            local item = data.data[i]
            if tostring(item.group.id) == tostring(groupId) then
                return item.role.name, item.role.rank
            end
        end
    end

    return nil
end

-- Get List of Groups
function roblox.getGroups(userId)
    local url = GROUPS_URL .. "/v2/users/" .. tostring(userId) .. "/groups/roles"
    local response = make_request(url, "GET", nil)
    local data = json.decode(response)

    if data and data.data then
        return data.data
    end

    return {}
end

-- Get User Info by Username
function roblox.userByName(username)
    local id = roblox.getUserId(username)
    if id then
        return roblox.getUser(id)
    end
    return -- not nil
end

-- Export module
return roblox