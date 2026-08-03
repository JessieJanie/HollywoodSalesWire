#!/bin/bash
set -e
pnpm install --frozen-lockfile
# Apply schema changes to the connected database using drizzle-kit push.
# push is idempotent — it computes the diff between the Drizzle schema files
# and the live DB and applies only what is missing, which is safe for both
# fresh databases and the existing production database (which was bootstrapped
# by prior push runs before versioned migrations were introduced).
#
# The SQL migration files in lib/db/migrations/ document the full schema and
# serve as the baseline for any future incremental migrations; they are NOT
# applied here because the production DB pre-dates the Drizzle journal and
# already contains the pre-existing tables at potentially different column sets.
pnpm --filter db push
