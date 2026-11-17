# Project workflow

Use this repository for every game iteration. Run `node run-checks.cjs` before committing gameplay changes. Keep commits focused and push completed iterations to GitHub. Tag completed versions as `v0.x.y` and publish a release with the matching game ZIP and concise gameplay changes. Never overwrite an existing version tag.

Keep README, design documents, commit messages and release notes focused on game behavior, changes and validation. Keep development tooling and authorship commentary out of project notes, READMEs and release descriptions. Do not add coauthor trailers.

Do not commit player saves, credentials, browser storage or local scratch files. Preserve save compatibility and describe material migration changes. When interacting with Cloudflare, use the cf CLI unless this project has a Wrangler configuration file.
