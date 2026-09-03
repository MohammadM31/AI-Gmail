// backend/src/services/emailTrackingService.ts
import { supabase } from "../utils/supabaseClient";
import { logger } from "../utils/logger";

interface TrackEmailOpenInput {
  emailId: string;
  recipientEmail: string;
  ipAddress?: string;
  userAgent?: string;
}

interface TrackEmailClickInput {
  emailId: string;
  recipientEmail: string;
  linkUrl: string;
  ipAddress?: string;
  userAgent?: string;
}

/**
 * Track when an email is opened
 */
export async function trackEmailOpen(input: TrackEmailOpenInput): Promise<void> {
  try {
    const { emailId, recipientEmail, ipAddress, userAgent } = input;

    // Insert or update tracking record
    const { data: existing } = await supabase
      .from("EmailTracking")
      .select("id, openedCount")
      .eq("emailId", emailId)
      .eq("recipientEmail", recipientEmail)
      .single();

    if (existing) {
      // Update existing record
      await supabase
        .from("EmailTracking")
        .update({
          openedCount: existing.openedCount + 1,
          openedAt: new Date().toISOString(),
          lastOpenedAt: new Date().toISOString(),
        })
        .eq("id", existing.id);
    } else {
      // Create new tracking record
      await supabase.from("EmailTracking").insert({
        emailId,
        recipientEmail,
        openedCount: 1,
        openedAt: new Date().toISOString(),
        lastOpenedAt: new Date().toISOString(),
        ipAddress,
        userAgent,
      });
    }

    // Update the email's open count
    await supabase.rpc("increment_email_open_count", {
      email_id: emailId,
    });

    logger.debug({ emailId, recipientEmail }, "Email open tracked");
  } catch (error) {
    // Don't fail the request if tracking fails
    logger.warn({ error, ...input }, "Failed to track email open");
  }
}

/**
 * Track when a link in an email is clicked
 */
export async function trackEmailClick(input: TrackEmailClickInput): Promise<void> {
  try {
    const { emailId, recipientEmail, linkUrl, ipAddress, userAgent } = input;

    // Insert or update tracking record
    const { data: existing } = await supabase
      .from("EmailTracking")
      .select("id, clickedLinks")
      .eq("emailId", emailId)
      .eq("recipientEmail", recipientEmail)
      .single();

    const clickData = {
      url: linkUrl,
      clickedAt: new Date().toISOString(),
      ipAddress,
      userAgent,
    };

    if (existing) {
      const links = existing.clickedLinks || [];
      links.push(clickData);

      await supabase
        .from("EmailTracking")
        .update({
          clickedLinks: links,
          lastClickedAt: new Date().toISOString(),
        })
        .eq("id", existing.id);
    } else {
      await supabase.from("EmailTracking").insert({
        emailId,
        recipientEmail,
        clickedLinks: [clickData],
        lastClickedAt: new Date().toISOString(),
        ipAddress,
        userAgent,
      });
    }

    // Update the email's click count
    await supabase.rpc("increment_email_click_count", {
      email_id: emailId,
    });

    logger.debug({ emailId, recipientEmail, linkUrl }, "Email click tracked");
  } catch (error) {
    // Don't fail the request if tracking fails
    logger.warn({ error, ...input }, "Failed to track email click");
  }
}

/**
 * Generate a tracking pixel URL
 */
export function generateTrackingPixel(emailId: string, recipientEmail: string): string {
  const baseUrl = process.env.BACKEND_URL || process.env.RENDER_EXTERNAL_URL;
  const encodedEmail = encodeURIComponent(recipientEmail);
  return `${baseUrl}/api/emails/track/open/${emailId}?recipient=${encodedEmail}`;
}

/**
 * Generate a tracked link URL
 */
export function generateTrackedLink(emailId: string, recipientEmail: string, originalUrl: string): string {
  const baseUrl = process.env.BACKEND_URL || process.env.RENDER_EXTERNAL_URL;
  const encodedEmail = encodeURIComponent(recipientEmail);
  const encodedUrl = encodeURIComponent(originalUrl);
  return `${baseUrl}/api/emails/track/click/${emailId}?recipient=${encodedEmail}&url=${encodedUrl}`;
}

/**
 * Get email tracking statistics
 */
export async function getEmailTrackingStats(emailId: string): Promise<{
  opens: number;
  uniqueOpens: number;
  clicks: number;
  uniqueClicks: number;
  recipients: {
    email: string;
    openedAt?: string;
    clickedAt?: string;
    clickCount: number;
  }[];
}> {
  try {
    const { data, error } = await supabase
      .from("EmailTracking")
      .select("*")
      .eq("emailId", emailId);

    if (error) throw error;

    const totalOpens = data.reduce((sum, r) => sum + (r.openedCount || 0), 0);
    const uniqueOpens = data.filter(r => r.openedAt).length;
    const totalClicks = data.reduce((sum, r) => sum + ((r.clickedLinks || []).length), 0);
    const uniqueClicks = data.filter(r => r.clickedLinks && r.clickedLinks.length > 0).length;

    return {
      opens: totalOpens,
      uniqueOpens,
      clicks: totalClicks,
      uniqueClicks,
      recipients: data.map(r => ({
        email: r.recipientEmail,
        openedAt: r.openedAt,
        clickedAt: r.clickedLinks && r.clickedLinks.length > 0 
          ? r.clickedLinks[r.clickedLinks.length - 1].clickedAt 
          : undefined,
        clickCount: r.clickedLinks ? r.clickedLinks.length : 0,
      })),
    };
  } catch (error) {
    logger.error({ error, emailId }, "Failed to get email tracking stats");
    return {
      opens: 0,
      uniqueOpens: 0,
      clicks: 0,
      uniqueClicks: 0,
      recipients: [],
    };
  }
}