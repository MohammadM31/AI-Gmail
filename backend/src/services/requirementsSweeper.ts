    // backend/src/services/requirementsSweeper.ts
    import { supabase } from "../utils/supabaseClient";
    import { logger } from "../utils/logger";
    import { getIo } from "../realtime/socket";
    import {
    analyzeThreadRequirements,
    createModificationProposal,
    } from "./requirementsService";
    import {
    markSprintReady,
    isSprintRolloverHour,
    } from "./sprintService";

    let isRunning = false;

    interface QueuedEmail {
    id: string;
    threadId: string | null;
    senderId: string;
    queuedForSprintId: string;
    }

    interface Sprint {
    id: string;
    organizationId: string;
    weekStart: string;
    weekEnd: string;
    status: "OPEN" | "ANALYZING" | "READY" | "CLOSED";
    }

    interface OrgRow {
    id: string;
    timezone: string | null;
    }

    /**
     * Analyze a single organization's queued emails for a sprint.
     * Creates Requirements and (where ready) Modification proposals.
     */
    async function runSweepForOrganization(
    org: OrgRow,
    sprint: Sprint
    ): Promise<void> {
    const organizationId = org.id;

    logger.info(
        { organizationId, sprintId: sprint.id, weekStart: sprint.weekStart },
        "Sweeper: starting analysis for organization"
    );

    // 1. Mark sprint ANALYZING so we don't process it again mid-run
    await supabase
        .from("Sprint")
        .update({ status: "ANALYZING", updatedAt: new Date().toISOString() })
        .eq("id", sprint.id);

    // 2. Fetch all QUEUED emails for this sprint
    const { data: queued, error: qErr } = await supabase
        .from("Email")
        .select("id, threadId, senderId, queuedForSprintId")
        .eq("queuedForSprintId", sprint.id)
        .eq("classification", "QUEUED")
        .is("deletedAt", null);

    if (qErr) {
        logger.error(
        { error: qErr.message, organizationId, sprintId: sprint.id },
        "Sweeper: failed to fetch queued emails"
        );
        await supabase
        .from("Sprint")
        .update({ status: "OPEN", updatedAt: new Date().toISOString() })
        .eq("id", sprint.id);
        return;
    }

    const emails = (queued ?? []) as QueuedEmail[];

    if (emails.length === 0) {
        logger.info(
        { organizationId, sprintId: sprint.id },
        "Sweeper: no queued emails this sprint"
        );
        await markSprintReady(sprint.id);
        return;
    }

    logger.info(
        { organizationId, sprintId: sprint.id, count: emails.length },
        "Sweeper: processing queued emails"
    );

    // 3. Group by (threadId, senderId) — one Requirement per thread per client
    const groups = new Map<string, QueuedEmail[]>();
    for (const email of emails) {
        if (!email.threadId) continue;
        const key = `${email.threadId}::${email.senderId}`;
        if (!groups.has(key)) groups.set(key, []);
        groups.get(key)!.push(email);
    }

    // 4. For each group, analyze and create a Requirement
    let requirementsCreated = 0;
    let proposalsCreated = 0;

    for (const [key, group] of groups.entries()) {
        const [threadId, clientUserId] = key.split("::");
        if (!threadId || !clientUserId) continue;

        try {
        const result = await analyzeThreadRequirements(
            organizationId,
            threadId,
            clientUserId
        );

        // Ensure the requirement is linked to this sprint and has an
        // assignedTeam. analyzeThreadRequirements doesn't know about
        // sprints, so we patch it here.
        const assignedTeam = pickAssignedTeam(result.analysis.category);

        const { data: requirement, error: reqErr } = await supabase
            .from("Requirement")
            .update({
            sprintId: sprint.id,
            assignedTeam,
            lastMessageAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            })
            .eq("id", result.requirement.id)
            .select()
            .single();

        if (reqErr || !requirement) {
            logger.warn(
            { error: reqErr?.message, requirementId: result.requirement.id },
            "Sweeper: failed to update requirement with sprint linkage"
            );
            continue;
        }

        requirementsCreated++;

        // Mark the source emails as CONTINUED so they don't re-queue
        const emailIds = group.map((e) => e.id);
        await supabase
            .from("Email")
            .update({
            classification: "CONTINUED",
            requirementId: requirement.id,
            classifiedAt: new Date().toISOString(),
            })
            .in("id", emailIds);

        // 5. Auto-generate a proposal if the requirement is ready
        if (
            requirement.status === "READY_FOR_PROPOSAL" &&
            requirement.projectId
        ) {
            try {
            await createModificationProposal(
                organizationId,
                requirement.id,
                clientUserId
            );

            // Link the modification to the sprint for the dashboard
            await supabase
                .from("Modification")
                .update({ sprintId: sprint.id })
                .eq("requirementId", requirement.id);

            proposalsCreated++;
            } catch (proposalErr) {
            logger.warn(
                {
                error:
                    proposalErr instanceof Error
                    ? proposalErr.message
                    : String(proposalErr),
                requirementId: requirement.id,
                },
                "Sweeper: proposal creation failed"
            );
            }
        }

        // 6. Notify the org room so the dashboard updates live
        const io = getIo();
        if (io) {
            io.to(`org:${organizationId}`).emit("requirement:created", {
            requirementId: requirement.id,
            sprintId: sprint.id,
            assignedTeam,
            clientUserId,
            threadId,
            });
        }
        } catch (err) {
        logger.error(
            {
            error: err instanceof Error ? err.message : String(err),
            threadId,
            clientUserId,
            },
            "Sweeper: failed to analyze thread group"
        );
        }
    }

    // 7. Mark sprint READY
    await markSprintReady(sprint.id);

    logger.info(
        {
        organizationId,
        sprintId: sprint.id,
        requirementsCreated,
        proposalsCreated,
        },
        "Sweeper: organization complete"
    );
    }

    /**
     * Map a category string to an initial assignedTeam suggestion.
     * The AI can override this later if we start passing team hints
     * in the prompt, but this gives a sane default.
     */
    function pickAssignedTeam(category: string): "IT" | "ADMIN" | "SUPER_ADMIN" {
    const c = (category || "").toLowerCase();
    if (
        c.includes("bug") ||
        c.includes("crash") ||
        c.includes("error") ||
        c.includes("fix") ||
        c.includes("incident") ||
        c.includes("outage")
    ) {
        return "IT";
    }
    if (
        c.includes("billing") ||
        c.includes("account") ||
        c.includes("permission") ||
        c.includes("role") ||
        c.includes("security")
    ) {
        return "SUPER_ADMIN";
    }
    return "ADMIN";
    }

    /**
     * Find the org's currently-OPEN sprint that has queued emails and is
     * past its weekEnd, then run the sweep for that org.
     *
     * Runs hourly. If an org's local time is not the rollover hour and
     * they have no analyzed-but-ready sprint, this is a no-op for them.
     */
    export async function runRequirementsSweep(): Promise<void> {
    if (isRunning) {
        logger.debug("Requirements sweeper already running, skipping");
        return;
    }
    isRunning = true;

    try {
        // Fetch every org with their timezone
        const { data: orgs, error: orgErr } = await supabase
        .from("Organization")
        .select("id, timezone");

        if (orgErr) {
        logger.error({ error: orgErr.message }, "Sweeper: failed to fetch orgs");
        return;
        }

        if (!orgs || orgs.length === 0) {
        logger.debug("Sweeper: no organizations");
        return;
        }

        const now = new Date();

        for (const org of orgs as OrgRow[]) {
        const timezone = org.timezone || "Asia/Beirut";

        // Is it this org's local Saturday 00:00–01:00?
        if (!isSprintRolloverHour(timezone, now)) {
            continue;
        }

        // Find an OPEN sprint for this org that should be analyzed.
        // Prefer the one that has just been closed by the week boundary.
        const { data: sprints, error: sErr } = await supabase
            .from("Sprint")
            .select("*")
            .eq("organizationId", org.id)
            .in("status", ["OPEN"])
            .order("weekStart", { ascending: false })
            .limit(1);

        if (sErr) {
            logger.warn(
            { error: sErr.message, orgId: org.id },
            "Sweeper: failed to fetch sprint"
            );
            continue;
        }

        const sprint = (sprints ?? [])[0] as Sprint | undefined;
        if (!sprint) {
            logger.debug({ orgId: org.id }, "Sweeper: no open sprint");
            continue;
        }

        // Extra safety: skip if there are no queued emails for this sprint
        const { count } = await supabase
            .from("Email")
            .select("id", { count: "exact", head: true })
            .eq("queuedForSprintId", sprint.id)
            .eq("classification", "QUEUED");

        if (!count || count === 0) {
            logger.debug(
            { orgId: org.id, sprintId: sprint.id },
            "Sweeper: sprint has no queued emails"
            );
            continue;
        }

        await runSweepForOrganization(org, sprint);
        }
    } catch (err) {
        logger.error(
        { error: err instanceof Error ? err.message : String(err) },
        "Sweeper: unhandled error"
        );
    } finally {
        isRunning = false;
    }
    }

    /**
     * Manual override: force the sweep to run for a specific sprint,
     * regardless of the current time or the org's timezone.
     * Used by the admin-triggered endpoint.
     */
    export async function forceSweepForSprint(sprintId: string): Promise<{
    requirementsCreated: number;
    proposalsCreated: number;
    }> {
    const { data: sprint, error: sErr } = await supabase
        .from("Sprint")
        .select("*")
        .eq("id", sprintId)
        .single();

    if (sErr || !sprint) {
        throw new Error("Sprint not found");
    }

    const { data: org, error: oErr } = await supabase
        .from("Organization")
        .select("id, timezone")
        .eq("id", sprint.organizationId)
        .single();

    if (oErr || !org) {
        throw new Error("Organization not found");
    }

    const beforeReqs = await countRequirementsForSprint(sprintId);
    const beforeProps = await countProposalsForSprint(sprintId);

    await runSweepForOrganization(org as OrgRow, sprint as Sprint);

    const afterReqs = await countRequirementsForSprint(sprintId);
    const afterProps = await countProposalsForSprint(sprintId);

    return {
        requirementsCreated: afterReqs - beforeReqs,
        proposalsCreated: afterProps - beforeProps,
    };
    }

    async function countRequirementsForSprint(sprintId: string): Promise<number> {
    const { count } = await supabase
        .from("Requirement")
        .select("id", { count: "exact", head: true })
        .eq("sprintId", sprintId);
    return count ?? 0;
    }

    async function countProposalsForSprint(sprintId: string): Promise<number> {
    const { count } = await supabase
        .from("Modification")
        .select("id", { count: "exact", head: true })
        .eq("sprintId", sprintId);
    return count ?? 0;
    }

    /**
     * Start the sweeper cron. Runs every `intervalMs` (default hourly).
     * The real work is gated by `isSprintRolloverHour`, so most runs
     * will be no-ops for most orgs.
     */
    export function startRequirementsSweeper(
    intervalMs: number = 60 * 60 * 1000
    ): NodeJS.Timeout {
    logger.info({ intervalMs }, "Requirements sweeper cron started");

    // Small delay so server startup completes first
    setTimeout(() => {
        runRequirementsSweep().catch((err) =>
        logger.error(
            { err: err instanceof Error ? err.message : String(err) },
            "Initial sweeper run failed"
        )
        );
    }, 15_000);

    const handle = setInterval(() => {
        runRequirementsSweep().catch((err) =>
        logger.error(
            { err: err instanceof Error ? err.message : String(err) },
            "Periodic sweeper run failed"
        )
        );
    }, intervalMs);

    return handle;
    }