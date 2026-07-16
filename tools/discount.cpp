// C++ — fast Robux discount/tax CLI (mirrors /discount and /tax).
// Build:  g++ -O2 -o discount tools/discount.cpp
// Usage:  ./discount <price> <discountPercent>
#include <cstdio>
#include <cstdlib>
#include <cmath>

int main(int argc, char** argv) {
    if (argc < 3) {
        std::printf("Usage: discount <price> <discountPercent>\n");
        return 1;
    }
    long price = std::atol(argv[1]);
    double pct = std::atof(argv[2]);
    long off = (long)std::lround(price * (pct / 100.0));
    long final_price = price - off;
    long afterTax = (long)(final_price * 0.7); // Roblox 30% marketplace fee

    std::printf("Original:   %ld R$\n", price);
    std::printf("Discount:   -%ld R$ (%.1f%%)\n", off, pct);
    std::printf("Final:      %ld R$\n", final_price);
    std::printf("After tax:  %ld R$ (you keep 70%%)\n", afterTax);
    return 0;
}
