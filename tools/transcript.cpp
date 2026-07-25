// Sentinel — transcript analyzer (C++17).
//
// A fast CLI for chewing through big exported chat logs / ticket transcripts.
// C++ is a great fit here: streaming a multi-megabyte text file and counting
// word frequencies is pure CPU/string work, and this stays well out of the live
// bot (it's a dev/ops tool you run on an exported .txt).
//
// Build:  g++ -O2 -std=c++17 tools/transcript.cpp -o tools/transcript
// Run:    ./tools/transcript path/to/transcript.txt          (or pipe via stdin)
//         ./tools/transcript --top 30 transcript.txt
//
// Prints: line / word / character counts + the most frequent words (stop-words
// and very short tokens filtered out).
#include <algorithm>
#include <cctype>
#include <fstream>
#include <iostream>
#include <string>
#include <unordered_map>
#include <unordered_set>
#include <vector>

static const std::unordered_set<std::string> STOP = {
    "the", "and", "you", "for", "that", "this", "with", "have", "was", "are",
    "but", "not", "your", "all", "can", "get", "its", "out", "just", "like",
    "what", "when", "they", "will", "his", "her", "him", "she", "how", "why"};

int main(int argc, char** argv) {
    int top = 20;
    std::string path;
    for (int i = 1; i < argc; ++i) {
        std::string a = argv[i];
        if (a == "--top" && i + 1 < argc) {
            top = std::max(1, std::min(200, std::atoi(argv[++i])));
        } else {
            path = a;
        }
    }

    std::istream* in = &std::cin;
    std::ifstream file;
    if (!path.empty()) {
        file.open(path);
        if (!file) {
            std::cerr << "error: cannot open " << path << "\n";
            return 1;
        }
        in = &file;
    }

    std::unordered_map<std::string, long> freq;
    long lines = 0, words = 0, chars = 0;
    std::string line, word;

    while (std::getline(*in, line)) {
        ++lines;
        chars += static_cast<long>(line.size());
        word.clear();
        auto flush = [&]() {
            if (word.size() >= 4 && !STOP.count(word)) ++freq[word];
            if (!word.empty()) ++words;
            word.clear();
        };
        for (char c : line) {
            if (std::isalnum(static_cast<unsigned char>(c))) {
                word.push_back(static_cast<char>(std::tolower(static_cast<unsigned char>(c))));
            } else {
                flush();
            }
        }
        flush();
    }

    std::vector<std::pair<std::string, long>> ranked(freq.begin(), freq.end());
    std::sort(ranked.begin(), ranked.end(), [](const auto& a, const auto& b) {
        return a.second != b.second ? a.second > b.second : a.first < b.first;
    });

    std::cout << "==== TRANSCRIPT ANALYSIS ====\n";
    std::cout << "lines : " << lines << "\n";
    std::cout << "words : " << words << "\n";
    std::cout << "chars : " << chars << "\n";
    std::cout << "unique words (len>=4): " << freq.size() << "\n";
    std::cout << "---- top " << top << " words ----\n";
    int shown = 0;
    for (const auto& [w, n] : ranked) {
        if (shown++ >= top) break;
        std::cout << "  " << n << "\t" << w << "\n";
    }
    return 0;
}
