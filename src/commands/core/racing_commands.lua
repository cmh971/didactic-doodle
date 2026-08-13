-- FLE ON 
INPORT ANT MODULES  

-- ============================================================================
-- racing_commands.lua — Complete 100 Racing Commands Pack
-- All commands start with ! and relate to racing, cars, and motorsport.
-- ============================================================================

local commands = {}

-- Simulated Player State & Database
local player = {
    car = "Mazda MX-5 Cup",
    livery = "Red Bull Racing",
    rating = 1500,
    safety_rating = 3.50,
    credits = 12500,
    inventory = {"Soft Tires", "Medium Tires", "Spare Wing"},
    fuel = 100, -- percentage
    tire_wear = 0, -- percentage
    engine_temp = 90, -- Celsius
    lap_time = 84.321,
    best_lap = 82.105,
    position = 4,
    total_laps = 15,
    current_lap = 6,
    engine_map = "Balanced"
}

-- Seed random generator once
math.randomseed(os.time())

-- Helper function to split input into words
local function parse_args(message)
    local args = {}
    for word in message:gmatch("%S+") do
        table.insert(args, word)
    end
    return args
end

-- ============================================================================
-- 100 RACING COMMANDS
-- ============================================================================

-- 🚗 VEHICLE & GARAGE COMMANDS (1–15)
commands["!car"] = function(args)
    print("🏎️ [GARAGE] Current Vehicle: " .. player.car)
end

commands["!cars"] = function(args)
    print("🏎️ [GARAGE] Available Cars: GT3 RS, Civic Type R, Formula 1, MX-5 Cup, Supra MK4, R34 GT-R")
end

commands["!swapcar"] = function(args)
    local new_car = table.concat(args, " ")
    if new_car == "" then new_car = "GT3 RS" end
    player.car = new_car
    print("🔄 [GARAGE] Swapped vehicle to: " .. player.car)
end

commands["!livery"] = function(args)
    local theme = table.concat(args, " ")
    if theme == "" then theme = "Gulf Racing" end
    player.livery = theme
    print("🎨 [LIVERY] Painted car in " .. player.livery .. " colors!")
end

commands["!engine"] = function(args)
    print("🔧 [ENGINE] Status: V8 Twin-Turbo | Oil Temp: 105°C | Health: 98%")
end

commands["!horsepower"] = function(args)
    print("🐎 [DYNO] Output: " .. math.random(450, 850) .. " HP @ 8,200 RPM")
end

commands["!toptime"] = function(args)
    print("⏱️ [RECORD] Track Record: 1:14.209 set by ApexRacer")
end

commands["!upgrade"] = function(args)
    local part = args[1] or "Turbocharger"
    print("🛠️ [UPGRADE] Installed Stage 2 " .. part .. "! +35 HP")
end

commands["!tuning"] = function(args)
    print("🔧 [SETUP] Camber: -2.5° | Toe: 0.1° | Tire Pressure: 28 PSI")
end

commands["!weight"] = function(args)
    print("⚖️ [WEIGHT] Total Curb Weight: " .. math.random(1100, 1450) .. " kg")
end

commands["!drivetrain"] = function(args)
    local types = {"AWD", "RWD", "FWD"}
    print("⚙️ [DRIVETRAIN] Configured for: " .. types[math.random(1, 3)])
end

commands["!spoiler"] = function(args)
    local angle = tonumber(args[1]) or 12
    print("🪽 [AERO] Rear wing angle set to " .. angle .. "° for extra downforce.")
end

commands["!gears"] = function(args)
    print("⚙️ [TRANSMISSION] 6-Speed Sequential | Final Drive Ratio: 3.73")
end

commands["!exhaust"] = function(args)
    print("🔊 [EXHAUST] Titanium straight-pipe installed. Pop and bang tune enabled!")
end

commands["!dyno"] = function(args)
    print("📊 [DYNO] Peak Torque: " .. math.random(400, 700) .. " Nm @ 5,500 RPM")
end

-- 🏁 RACE CONTROL & TRACK DATA (16–30)
commands["!track"] = function(args)
    local tracks = {"Spa-Francorchamps", "Monza", "Nürburgring Nordschleife", "Laguna Seca", "Silverstone"}
    print("🛣️ [CIRCUIT] Current Track: " .. tracks[math.random(1, #tracks)])
end

commands["!laps"] = function(args)
    print("🏁 [RACE] Lap " .. player.current_lap .. " / " .. player.total_laps)
end

commands["!laptime"] = function(args)
    print("⏱️ [TIMING] Last Lap: " .. string.format("%.3f", player.lap_time) .. "s")
end

commands["!bestlap"] = function(args)
    print("🟣 [PURPLE] Personal Best Lap: " .. string.format("%.3f", player.best_lap) .. "s")
end

commands["!position"] = function(args)
    print("📊 [STANDINGS] You are currently in P" .. player.position)
end

commands["!gap"] = function(args)
    print("⏱️ [GAP] Leader: +3.210s | Car Behind: -1.045s")
end

commands["!flag"] = function(args)
    local flags = {"🟢 GREEN FLAG (Clear Track)", "🟡 YELLOW FLAG (Caution Sector 2)", "🔴 RED FLAG (Session Suspended)", "🏁 CHECKERED FLAG"}
    print("🚩 [RACE CONTROL] " .. flags[math.random(1, #flags)])
end

commands["!grid"] = function(args)
    print("🚦 [START GRID] P1: Hamilton | P2: Verstappen | P3: Leclerc | P4: " .. (args[1] or "You"))
end

commands["!sector1"] = function(args)
    print("⏱️ [SECTOR 1] Split: 24.102s (Green)")
end

commands["!sector2"] = function(args)
    print("⏱️ [SECTOR 2] Split: 31.840s (Purple - Session Best!)")
end

commands["!sector3"] = function(args)
    print("⏱️ [SECTOR 3] Split: 26.163s (Yellow)")
end

commands["!delta"] = function(args)
    local delta = (math.random(-50, 50) / 100)
    print("📉 [DELTA] " .. (delta <= 0 and "🟢 " or "🔴 ") .. string.format("%+.2f", delta) .. "s vs Personal Best")
end

commands["!safetycar"] = function(args)
    print("🏎️💨 [SAFETY CAR] Safety Car deployed! Reduce speed and form single file.")
end

commands["!vsc"] = function(args)
    print("🟡 [VSC] Virtual Safety Car active. Maintain delta time!")
end

commands["!penalty"] = function(args)
    print("⚠️ [STEWARDS] 5-second time penalty for exceeding track limits at Turn 4!")
end

-- ⛽ PIT STOP & TELEMETRY (31–45)
commands["!pit"] = function(args)
    player.fuel = 100
    player.tire_wear = 0
    print("⛽ [PIT STOP] Refueled to 100%! Fresh tires fitted! Stop time: 2.4s")
end

commands["!tires"] = function(args)
    print("🛞 [TIRES] Wear: FL 82% | FR 79% | RL 91% | RR 88%")
end

commands["!compound"] = function(args)
    local comp = args[1] or "Soft"
    print("🛞 [TIRES] Selected Compound for next pitstop: " .. comp)
end

commands["!fuel"] = function(args)
    print("⛽ [TELEMETRY] Fuel Level: " .. player.fuel .. "% (" .. math.random(4, 12) .. " laps remaining)")
end

commands["!fuelmap"] = function(args)
    local maps = {"Lean (Save)", "Balanced", "Push (High Power)"}
    player.engine_map = maps[math.random(1, 3)]
    print("🎛️ [ENGINE MAP] Set to: " .. player.engine_map)
end

commands["!drs"] = function(args)
    print("🟢 [DRS] DRS Available! Wing opened for maximum straight-line speed.")
end

commands["!ers"] = function(args)
    print("⚡ [HYBRID] ERS Overtake Mode ENABLED! +160 HP deployment!")
end

commands["!brake"] = function(args)
    print("🛑 [TELEMETRY] Brake Temp: 650°C | Bias: 54% Front")
end

commands["!brakebias"] = function(args)
    local bias = tonumber(args[1]) or 56
    print("🎛️ [BIAS] Front Brake Bias set to " .. bias .. "%")
end

commands["!psi"] = function(args)
    print("💨 [TIRE PRESSURE] FL: 27.5 PSI | FR: 27.8 PSI | RL: 26.9 PSI | RR: 27.1 PSI")
end

commands["!temp"] = function(args)
    print("🌡️ [TELEMETRY] Engine: " .. player.engine_temp .. "°C | Track Temp: 38°C")
end

commands["!box"] = function(args)
    print("📻 [RADIO] 'Box, Box, Box! Pit this lap!'")
end

commands["!telemetry"] = function(args)
    print("📊 [DATA] Speed: 284 km/h | Gear: 6th | RPM: 7,800 | Throttle: 100%")
end

commands["!damage"] = function(args)
    print("💥 [DAMAGE REPORT] Front Wing: Slight damage | Suspension: OK | Aero: 94%")
end

commands["!repair"] = function(args)
    print("🔧 [MECHANICS] Bodywork repaired! Vehicle at 100% aero efficiency.")
end

-- 🌧️ WEATHER & ENVIRONMENT (46–55)
commands["!weather"] = function(args)
    local w = {"Clear Skies ☀️", "Overcast ☁️", "Light Rain 🌦️", "Heavy Rain 🌧️"}
    print("🌤️ [WEATHER] Conditions: " .. w[math.random(1, #w)])
end

commands["!radar"] = function(args)
    print("📡 [RADAR] Rain cloud expected in 8 minutes over Turn 7.")
end

commands["!wetness"] = function(args)
    print("🌧️ [TRACK STATUS] Track Moisture: " .. math.random(0, 85) .. "% (Intermediates recommended)")
end

commands["!wind"] = function(args)
    print("💨 [ENVIRONMENT] Wind Speed: 14 km/h Headwind on the main straight")
end

commands["!humidity"] = function(args)
    print("💧 [ATMOSPHERE] Humidity: 62% | Air Density: 1.225 kg/m³")
end

commands["!sun"] = function(args)
    print("🌅 [SESSION] Time of Day: Sunset | Track visibility reduced")
end

commands["!night"] = function(args)
    print("🌙 [SESSION] Night race conditions active! Headlights on.")
end

commands["!airtemp"] = function(args)
    print("🌡️ [ATMOSPHERE] Ambient Temperature: 22°C")
end

commands["!grip"] = function(args)
    print("🛤️ [SURFACE] Track Grip Level: 98% (Optimum Rubbered Line)")
end

commands["!marbles"] = function(args)
    print("⚠️ [WARNING] Tire marbles collecting off the racing line in Sector 3!")
end

-- ⚔️ ACTIONS & DRIVING TECHNIQUES (56–75)
commands["!drift"] = function(args)
    print("💨 [DRIFT] Pulled handbrake! Angle: 45° | Drift Points: " .. math.random(500, 3000))
end

commands["!overtake"] = function(args)
    local target = args[1] or "Rival"
    print("⚔️ [OVERTAKE] Divetomb down the inside at Turn 1! You passed " .. target .. "!")
end

commands["!launch"] = function(args)
    print("🚀 [LAUNCH CONTROL] RPM held at 4,500... Clutch dropped! 0-100 km/h in 2.8s!")
end

commands["!burnout"] = function(args)
    print("🔥 [SHOWOFF] Warming up rear tires! Thick white smoke everywhere!")
end

commands["!draft"] = function(args)
    local lead = args[1] or "Lead Car"
    print("🏎️💨 [SLIPSTREAM] Tucked in behind " .. lead .. "! Gained +12 km/h top speed.")
end

commands["!spin"] = function(args)
    print("🌀 [CRASH] Spun out at Turn 5! Lost 6 seconds recovery time.")
end

commands["!bump"] = function(args)
    print("💥 [CONTACT] Rubbing is racing! Bumped side-by-side down the straight.")
end

commands["!block"] = function(args)
    print("🛡️ [DEFENSE] Covered the inside line defensively. Move complete!")
end

commands["!rev"] = function(args)
    print("🔊 VROOM! VROOM! *Engine limiter bouncing at 9,000 RPM*")
end

commands["!donut"] = function(args)
    print("🍩 Spinning 360 donuts on the pit straight to celebrate!")
end

commands["!nos"] = function(args)
    print("🔵 [NITROUS] NOS Triggered! Extra thrust activated!")
end

commands["!heeltoe"] = function(args)
    print("👟 [TECHNIQUE] Perfect heel-toe downshift into 2nd gear!")
end

commands["!apex"] = function(args)
    print("🎯 [CORNERING] Clipped the apex perfectly on the curbing!")
end

commands["!outbrake"] = function(args)
    print("🛑 [MOVE] Late braking maneuver success! Outbraked opponent into hairpin.")
end

commands["!understeer"] = function(args)
    print("⚠️ [HANDLING] Front tires pushing wide! Understeer detected.")
end

commands["!oversteer"] = function(args)
    print("⚠️ [HANDLING] Rear end stepping out! Countersteering to catch the slide!")
end

commands["!jumpstart"] = function(args)
    print("❌ [FALSE START] Jumped the lights! Drive-through penalty issued.")
end

commands["!stint"] = function(args)
    print("⏱️ [STINT] Current stint duration: 18 laps on Soft Compound")
end

commands["!warmup"] = function(args)
    print("🛞 Weaving left and right across the track to build tire temperature.")
end

commands["!cool down"] = function(args)
    print("🧊 Driving off-line to pick up wet marbles and cool down tire carcass.")
end

-- 🏆 CAREER & MULTIPLAYER (76–90)
commands["!irating"] = function(args)
    print("📈 [RATING] iRating / Driver Skill Score: " .. player.rating)
end

commands["!safety"] = function(args)
    print("🛡️ [SAFETY CLASS] Safety Rating: " .. string.format("%.2f", player.safety_rating) .. " (Class A)")
end

commands["!credits"] = function(args)
    print("💰 [BANK] Balance: $" .. player.credits .. " Racing Credits")
end

commands["!trophies"] = function(args)
    print("🏆 [CABINET] 1st Place: 12 | 2nd Place: 8 | 3rd Place: 15")
end

commands["!sponsor"] = function(args)
    print("👔 [SPONSOR] Primary Sponsor: Brembo Brakes ($2,500 per race bonus)")
end

commands["!championship"] = function(args)
    print("📊 [STANDINGS] Season Points: 184 | Rank: 2nd Place overall")
end

commands["!rival"] = function(args)
    print("⚔️ [RIVAL] Main Competitor: 'SpeedyGonzales' (+12 pts ahead)")
end

commands["!license"] = function(args)
    print("🪪 [LICENSE] FIA Super License Status: ACTIVE")
end

commands["!team"] = function(args)
    print("👥 [TEAM] Member of: 'Apex Predators Esports'")
end

commands["!crew"] = function(args)
    print("🎧 [RADIO CREW] Chief Engineer: Marco | Spotter: Dave")
end

commands["!contract"] = function(args)
    print("📜 [CONTRACT] Signed with Red Bull Esports through end of season.")
end

commands["!payout"] = function(args)
    local prize = math.random(1000, 5000)
    player.credits = player.credits + prize
    print("💵 [PRIZE] Earned $" .. prize .. " credits for race performance!")
end

commands["!stats"] = function(args)
    print("📊 [STATS] Races: 142 | Wins: 34 | Podiums: 81 | Pole Positions: 19")
end

commands["!bet"] = function(args)
    local amount = tonumber(args[1]) or 100
    math.randomseed(os.time())
    if math.random(1, 2) == 1 then
        player.credits = player.credits + amount
        print("🎰 [BET] You won $" .. amount .. " credits on the race winner!")
    else
        player.credits = player.credits - amount
        print("🎰 [BET] Lost $" .. amount .. " credits. Better luck next time.")
    end
end

commands["!inventory"] = function(args)
    print("🎒 [INVENTORY] Items: " .. table.concat(player.inventory, ", "))
end

-- 📻 RADIO & FUN MISC (91–100)
commands["!radio"] = function(args)
    local msgs = {"'Leave me alone, I know what I'm doing!'", "'Copy, we are checking...'", "'Multi-21, man!'"}
    print("📻 [RADIO] " .. msgs[math.random(1, #msgs)])
end

commands["!horn"] = function(args)
    print("📢 BEEP BEEP! Move out of the way!")
end

commands["!radiocheck"] = function(args)
    print("📻 'Loud and clear! How do you read me?'")
end

commands["!spotter"] = function(args)
    local spot = {"'Clear left!'", "'Car inside, hold your line!'", "'Still there, still there... Clear! '"}
    print("🎧 [SPOTTER] " .. spot[math.random(1, #spot)])
end

commands["!replay"] = function(args)
    print("📹 [REPLAY] Saving instant replay of last lap maneuver to clip library...")
end

commands["!photo"] = function(args)
    print("📸 [PHOTO MODE] Snapshot taken at 4K resolution!")
end

commands["!lights"] = function(args)
    print("💡 Flashed high beams at car ahead!")
end

commands["!ragequit"] = function(args)
    print("💥 [DISCONNECT] Player slammed wheel and left the lobby!")
end

commands["!gg"] = function(args)
    print("🏁 [CHAT] Good game everyone! Great racing out there!")
end

commands["!help"] = function(args)
    print("🏎️ [RACING COMMANDS] 100 Commands Loaded! Try: !car, !pit, !laps, !drift, !telemetry, !weather, !flag, !overtake")
end

-- ============================================================================
-- CENTRAL COMMAND DISPATCHER
-- ============================================================================

local function handleCommand(message)
    local args = parse_args(message)
    local cmd = args[1]

    if cmd and cmd:sub(1, 1) == "!" then
        cmd = cmd:lower()
        table.remove(args, 1) -- remove command name from arguments list

        if commands[cmd] then
            commands[cmd](args)
        else
            print("❌ Unknown racing command: " .. cmd .. " (Type !help for commands)")
        end
    end
end

-- Example Test Execution Loop
print("--- TESTING RACING COMMANDS ---")
handleCommand("!help")
handleCommand("!car")
handleCommand("!track")
handleCommand("!launch")
handleCommand("!drift")
handleCommand("!telemetry")
handleCommand("!pit")
handleCommand("!overtake Hamilton")
handleCommand("!flag")