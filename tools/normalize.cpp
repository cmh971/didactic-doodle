// Sentinel word-list normalizer.
//
// Applies the SAME leetspeak/normalization the bot's bad-word filter uses
// (see src/ai/gemini.js -> normalizeForProfanity), so you can pre-process or
// audit words.json from the command line. Reads words (one per line) from a file
// argument or stdin; prints the normalized, de-duplicated, sorted list.
//
// Build:  g++ -O2 -std=c++17 -o normalize tools/normalize.cpp
// Run:    ./normalize words.txt
//         cat words.txt | ./normalize > cleaned.txt
#include <algorithm>
#include <cctype>
#include <fstream>
#include <iostream>
#include <set>
#include <string>
#include <unordered_map>

// Mirrors PROFANITY_LEET_MAP: characters that get mapped to a letter.
static const std::unordered_map<char, char> kLeet = {
    {'0', 'o'}, {'1', 'i'}, {'2', 'z'}, {'3', 'e'}, {'4', 'a'}, {'5', 's'},
    {'6', 'g'}, {'7', 't'}, {'8', 'b'}, {'9', 'g'}, {'@', 'a'}, {'$', 's'},
    {'!', 'i'}, {'+', 't'}, {'|', 'i'}, {'#', 'h'}, {'%', 'o'}, {'&', 'n'},
};

// Normalize a single token the way the filter does:
//   lowercase -> leet map -> strip non-alphanumerics -> collapse 3+ repeats to 2.
std::string Normalize(const std::string& input) {
    std::string mapped;
    mapped.reserve(input.size());
    for (char c : input) {
        char lc = static_cast<char>(std::tolower(static_cast<unsigned char>(c)));
        auto it = kLeet.find(lc);
        mapped += (it != kLeet.end()) ? it->second : lc;
    }

    std::string alnum;
    alnum.reserve(mapped.size());
    for (char c : mapped) {
        if (std::isalnum(static_cast<unsigned char>(c))) alnum += c;
    }

    std::string out;
    out.reserve(alnum.size());
    for (std::size_t i = 0; i < alnum.size();) {
        std::size_t run = 1;
        while (i + run < alnum.size() && alnum[i + run] == alnum[i]) ++run;
        out += alnum[i];
        if (run >= 2) out += alnum[i];  // keep at most a double letter
        i += run;
    }
    return out;
}

int main(int argc, char** argv) {
    std::istream* in = &std::cin;
    std::ifstream file;
    if (argc > 1) {
        file.open(argv[1]);
        if (!file) {
            std::cerr << "Cannot open file: " << argv[1] << "\n";
            return 1;
        }
        in = &file;
    }

    std::set<std::string> words;  // sorted + de-duplicated
    std::string line;
    while (std::getline(*in, line)) {
        std::string normalized = Normalize(line);
        if (!normalized.empty()) words.insert(normalized);
    }

    for (const std::string& w : words) std::cout << w << "\n";
    std::cerr << "Normalized " << words.size() << " unique words.\n";
    return 0;
}
