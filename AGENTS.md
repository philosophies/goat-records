# Project workflow

Use this repository for every game iteration. Run `node run-checks.cjs` before committing gameplay changes. Keep commits focused and push completed iterations to GitHub. Mark each completed version with a `## v0.x.y` heading at the top of CHANGELOG.md, followed by concise gameplay changes. Pushing it to main runs the checks, tags the version and publishes a release with the matching game ZIP. Never overwrite an existing version tag.

Keep README, design documents, commit messages and release notes focused on game behavior, changes and validation. Keep development tooling and authorship commentary out of project notes, READMEs and release descriptions. Do not add coauthor trailers.

Do not commit player saves, credentials, browser storage or local scratch files. Preserve save compatibility and describe material migration changes. When interacting with Cloudflare, use the cf CLI unless this project has a Wrangler configuration file.
