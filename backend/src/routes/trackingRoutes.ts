// backend/src/routes/trackingRoutes.ts
import { Router } from "express";
import { trackEmailOpen, trackEmailClick } from "../services/emailTrackingService";
import { logger } from "../utils/logger";

const router = Router();

// Tracking pixel endpoint (1x1 transparent GIF)
router.get("/open/:emailId", async (req, res) => {
  try {
    const { emailId } = req.params;
    const recipient = req.query.recipient as string;

    if (emailId && recipient) {
      // Track the open asynchronously (don't await)
      trackEmailOpen({
        emailId,
        recipientEmail: recipient,
        ipAddress: req.ip,
        userAgent: req.headers["user-agent"],
      }).catch((error) => {
        logger.warn({ error, emailId, recipient }, "Failed to track email open");
      });
    }

    // Return a 1x1 transparent GIF
    const pixel = Buffer.from(
      "R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7",
      "base64"
    );
    res.writeHead(200, {
      "Content-Type": "image/gif",
      "Content-Length": pixel.length,
      "Cache-Control": "no-cache, no-store, must-revalidate",
      "Pragma": "no-cache",
      "Expires": "0",
    });
    res.end(pixel);
  } catch (error) {
    // Always return the pixel, even on error
    const pixel = Buffer.from(
      "R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7",
      "base64"
    );
    res.writeHead(200, {
      "Content-Type": "image/gif",
      "Content-Length": pixel.length,
    });
    res.end(pixel);
  }
});

// Tracked link redirect endpoint
router.get("/click/:emailId", async (req, res) => {
  try {
    const { emailId } = req.params;
    const recipient = req.query.recipient as string;
    const url = req.query.url as string;

    if (emailId && recipient && url) {
      // Track the click asynchronously
      trackEmailClick({
        emailId,
        recipientEmail: recipient,
        linkUrl: url,
        ipAddress: req.ip,
        userAgent: req.headers["user-agent"],
      }).catch((error) => {
        logger.warn({ error, emailId, recipient, url }, "Failed to track email click");
      });
    }

    // Redirect to the original URL
    const decodedUrl = url ? decodeURIComponent(url) : "/";
    res.redirect(decodedUrl);
  } catch (error) {
    logger.error({ error, ...req.params, ...req.query }, "Failed to track email click");
    res.redirect("/");
  }
});

export default router;