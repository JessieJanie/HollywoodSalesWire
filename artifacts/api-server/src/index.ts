import app from "./app";
import { logger } from "./lib/logger";
import { startScheduler } from "./lib/scheduler";
import { initStripe } from "./lib/stripeInit";

// Fail fast if object-storage env vars are missing.
// All three are set by setupObjectStorage() via Replit secrets and must be
// present at runtime for the Special Reports upload/download flow to work.
const requiredObjectStorageVars = [
  "DEFAULT_OBJECT_STORAGE_BUCKET_ID",
  "PRIVATE_OBJECT_DIR",
  "PUBLIC_OBJECT_SEARCH_PATHS",
] as const;
const missingObjStorage = requiredObjectStorageVars.filter((k) => !process.env[k]);
if (missingObjStorage.length > 0) {
  logger.error(
    { missing: missingObjStorage },
    "Object storage env vars are not set — Special Reports upload/download will fail. " +
      "Run setupObjectStorage() in the Replit workspace to provision the bucket and set these secrets.",
  );
}

const rawPort = process.env["PORT"];

if (!rawPort) {
  throw new Error(
    "PORT environment variable is required but was not provided.",
  );
}

const port = Number(rawPort);

if (Number.isNaN(port) || port <= 0) {
  throw new Error(`Invalid PORT value: "${rawPort}"`);
}

app.listen(port, (err) => {
  if (err) {
    logger.error({ err }, "Error listening on port");
    process.exit(1);
  }

  logger.info({ port }, "Server listening");
  startScheduler();
  void initStripe();
});
