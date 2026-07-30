import { Router, type IRouter } from "express";
import healthRouter from "./health";
import subscribeRouter from "./subscribe";
import foundingOfferRouter from "./foundingOffer";
import foundingCheckoutRouter from "./foundingCheckout";
import publisherRouter from "./publisher";

const router: IRouter = Router();

router.use(healthRouter);
router.use(subscribeRouter);
router.use(foundingOfferRouter);
router.use(foundingCheckoutRouter);
router.use(publisherRouter);

export default router;
