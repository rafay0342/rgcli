# backups/

A full copy of the working tree, taken with `tar -czf` and split so every
piece stays well under GitHub's file-size limits.

## What is in it

Everything in the repository root except `node_modules/` and `.git/`:
source, `site/` with all of its assets — the frame sequences, the clips
and posters, the stills, the locket portraits — `deb-build/`, `bin/`,
`distribution/`, `snap/`, `.github/`, `.claude/`, and every config and
lockfile. `MANIFEST.txt` lists all 1287 files.

`.git/` is left out on purpose: the history is the repository itself, and
folding it into an archive stored inside that same repository would grow
it without adding anything.

## Restoring

```sh
cat backups/rgcli-20260827.tar.gz.part* > rgcli-20260827.tar.gz
sha256sum -c backups/rgcli-20260827.tar.gz.sha256   # optional, checks the join
mkdir restored && tar -xzf rgcli-20260827.tar.gz -C restored
```

The parts must be concatenated in name order — the glob above does that.

## This snapshot

| | |
| --- | --- |
| taken | 2026-08-27 |
| files | 1287 |
| archive | 96,225,043 bytes (91.8 MiB) gzipped |
| parts | 3 × 45 MiB max |
| sha256 | `9736c4e9dc7679bd46588d21a239c5348ca9c181a70655e333a4e2631ce1ea79` |

## Taking another one

```sh
tar --exclude=./node_modules --exclude=./.git --exclude=./backups \
    -czf /tmp/rgcli-backup.tar.gz -C . .
split -b 45M -d -a 2 /tmp/rgcli-backup.tar.gz backups/rgcli-$(date -u +%Y%m%d).tar.gz.part
```
