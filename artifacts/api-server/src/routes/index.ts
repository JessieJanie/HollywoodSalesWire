import { Router, type IRouter } from "express";
import healthRouter from "./health";
import subscribeRouter from "./subscribe";
import foundingOfferRouter from "./foundingOffer";
import foundingCheckoutRouter from "./foundingCheckout";

const router: IRouter = Router();

router.use(healthRouter);
router.use(subscribeRouter);
router.use(foundingOfferRouter);
router.use(foundingCheckoutRouter);

export default router;
