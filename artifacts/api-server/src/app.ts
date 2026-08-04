import express, { type Express } from "express";
import cookieParser from "cookie-parser";
import cors from "cors";
import pinoHttp from "pino-http";
import router from "./routes";
import { logger } from "./lib/logger";

const app: Express = express();

app.use(
  pinoHttp({
    logger,
    serializers: {
      req(req) {
        return {
          id: req.id,
          method: req.method,
          url: req.url?.split("?")[0],
        };
      },
      res(res) {
        return {
          statusCode: res.statusCode,
        };
      },
    },
  }),
);
app.use(cors());
app.use(cookieParser());

// Stripe webhook needs the raw body for signature verification, so this route
// is registered BEFORE express.json().
app.post(
  "/api/stripe/webhook",
  express.raw({ type: "application/json" }),
  async (req, res) => {
    const signature = req.headers["stripe-signature"];
    if (!signature) {
      res.status(400).json({ error: "Missing stripe-signature" });
      return;
    }
    const sig = Array.isArray(signature) ? signature[0] : signature;
    if (!Buffer.isBuffer(req.body) || !sig) {
      res.status(400).json({ error: "Webhook processing error" });
      return;
    }
    try {
      // Verifies the signature and syncs Stripe data into the `stripe` schema.
      const { WebhookHandlers } = await import("./lib/webhookHandlers");
      await WebhookHandlers.processWebhook(req.body as Buffer, sig);
    } catch (err) {
      req.log.error({ err }, "stripe webhook verification/sync failed");
      res.status(400).json({ error: "Webhook processing error" });
      return;
    }
    // Signature verified above — now run our membership automation.
    try {
      const { handleStripeEvent } = await import("./lib/members");
      const event = JSON.parse(req.body.toString("utf8"));
      await handleStripeEvent(event);
    } catch (err) {
      // Member persistence failed — return 500 so Stripe retries the event.
      // (Email side effects never throw; they log and self-recover on retry.)
      req.log.error({ err }, "stripe member automation failed — asking Stripe to retry");
      res.status(500).json({ error: "Member processing failed" });
      return;
    }
    res.status(200).json({ received: true });
  },
);

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use("/api", router);

// Public HTML archive of sent Weekly Briefs (crawler-readable marketing pages).
// Mounted outside /api on purpose — see routes/briefs.ts. Lazy-imported the
// same way other heavy modules are.
app.use("/briefs", (req, res, next) => {
  import("./routes/briefs")
    .then((m) => m.default(req, res, next))
    .catch(next);
});

export default app;
