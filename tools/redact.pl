#!/usr/bin/perl
# Sentinel — log secret redactor (Perl).
#
# Strips secrets out of logs/transcripts before you share them: Discord tokens,
# emails, IPs, API keys, Redis/Mongo URLs with credentials. Perl is the classic
# choice here — its regex engine is unmatched for this kind of text munging, and
# it streams line-by-line so it handles huge files.
#
# Run:  perl tools/redact.pl  < bot.log          (stdin)
#       pm2 logs sentinel --nostream | perl tools/redact.pl
use strict;
use warnings;

while (my $line = <>) {
    $line =~ s/[A-Za-z\d_-]{24,28}\.[\w-]{6}\.[\w-]{27,40}/[DISCORD_TOKEN]/g;       # bot tokens
    $line =~ s/\b[\w.+-]+@[\w-]+\.[\w.-]+\b/[EMAIL]/g;                              # emails
    $line =~ s/\b(?:\d{1,3}\.){3}\d{1,3}\b/[IP]/g;                                  # IPv4
    $line =~ s/\b(?:sk-|xox[baprs]-|ghp_|AIza)[A-Za-z0-9_-]{10,}/[API_KEY]/g;       # common API keys
    $line =~ s{rediss?://\S+}{[REDIS_URL]}g;                                        # redis URLs w/ creds
    $line =~ s{mongodb(?:\+srv)?://\S+}{[MONGO_URI]}g;                              # mongo URIs
    print $line;
}
