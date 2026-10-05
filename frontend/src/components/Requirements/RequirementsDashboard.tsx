import { useEffect, useState } from "react";

import {
  listRequirements,
  listModifications,
  createModificationProposal,
  reviewModification,
} from "../../services/apiClient";

import type {
  Requirement,
  Modification,
} from "../../types";

export function RequirementsDashboard() {
  const [requirements, setRequirements] =
    useState<Requirement[]>([]);

  const [modifications, setModifications] =
    useState<Modification[]>([]);

  const [loading, setLoading] =
    useState(true);

  const [error, setError] =
    useState<string | null>(null);

  const [processingId, setProcessingId] =
    useState<string | null>(null);

  async function load() {
    try {
      setLoading(true);
      setError(null);

      const [
        requirementsData,
        modificationsData,
      ] = await Promise.all([
        listRequirements(),
        listModifications(),
      ]);

      setRequirements(
        requirementsData
      );

      setModifications(
        modificationsData
      );
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Failed to load requirements"
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function createProposal(
    requirementId: string
  ) {
    try {
      setProcessingId(
        requirementId
      );

      setError(null);

      await createModificationProposal(
        requirementId
      );

      await load();
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Failed to create modification proposal"
      );
    } finally {
      setProcessingId(null);
    }
  }

  async function review(
    modificationId: string,
    decision:
      | "ACCEPTED"
      | "REJECTED"
      | "CHANGES_REQUESTED"
  ) {
    try {
      setProcessingId(
        modificationId
      );

      setError(null);

      await reviewModification(
        modificationId,
        decision
      );

      await load();
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Failed to review modification"
      );
    } finally {
      setProcessingId(null);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="text-sm opacity-60">
          Loading requirements...
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8 max-w-6xl mx-auto">

      {error && (
        <div className="rounded-xl border border-red-500/20 bg-red-500/10 text-red-500 p-4 text-sm">
          {error}
        </div>
      )}

      {/* ================================================== */}
      {/* REQUIREMENTS */}
      {/* ================================================== */}

      <section>
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-lg font-semibold">
              Client Requirements
            </h2>

            <p className="text-sm opacity-50 mt-1">
              Requirements extracted from client
              conversations.
            </p>
          </div>

          <span className="text-xs opacity-50">
            {requirements.length} requirements
          </span>
        </div>

        <div className="space-y-4">

          {requirements.length === 0 && (
            <div className="border border-dashed border-black/10 dark:border-white/10 rounded-xl p-10 text-center text-sm opacity-50">
              No requirements have been extracted yet.
            </div>
          )}

          {requirements.map(
            (requirement) => (
              <div
                key={requirement.id}
                className="rounded-xl border border-black/10 dark:border-white/10 bg-surface-light dark:bg-surface-dark p-5"
              >
                <div className="flex items-start justify-between gap-4">

                  <div className="min-w-0">
                    <h3 className="font-medium">
                      {requirement.request}
                    </h3>

                    <div className="flex flex-wrap gap-2 mt-2">

                      <span className="text-xs rounded-full px-2.5 py-1 bg-black/5 dark:bg-white/5">
                        {requirement.category}
                      </span>

                      <span className="text-xs rounded-full px-2.5 py-1 bg-black/5 dark:bg-white/5">
                        {requirement.priority}
                      </span>

                      <span className="text-xs rounded-full px-2.5 py-1 bg-black/5 dark:bg-white/5">
                        {requirement.status}
                      </span>

                    </div>
                  </div>

                  <div className="text-right shrink-0">
                    <div className="text-sm font-medium">
                      {Math.round(
                        requirement.confidence *
                          100
                      )}
                      %
                    </div>

                    <div className="text-[11px] opacity-50">
                      AI confidence
                    </div>
                  </div>

                </div>

                {requirement.details.length >
                  0 && (
                  <div className="mt-5">
                    <p className="text-xs uppercase tracking-wide opacity-40 mb-2">
                      Details
                    </p>

                    <ul className="space-y-1.5 text-sm opacity-75">
                      {requirement.details.map(
                        (
                          detail,
                          index
                        ) => (
                          <li
                            key={index}
                            className="flex gap-2"
                          >
                            <span className="opacity-40">
                              •
                            </span>

                            <span>
                              {detail}
                            </span>
                          </li>
                        )
                      )}
                    </ul>
                  </div>
                )}

                {requirement.clarificationNeeded && (
                  <div className="mt-5 rounded-lg border border-yellow-500/20 bg-yellow-500/10 text-yellow-700 dark:text-yellow-400 p-4 text-sm">
                    <div className="font-medium">
                      Clarification required
                    </div>

                    <div className="mt-1 opacity-80">
                      {
                        requirement.clarificationQuestion
                      }
                    </div>
                  </div>
                )}

                {requirement.status ===
                  "READY_FOR_PROPOSAL" && (
                  <div className="mt-5">
                    <button
                      disabled={
                        processingId ===
                        requirement.id
                      }
                      onClick={() =>
                        createProposal(
                          requirement.id
                        )
                      }
                      className="rounded-lg px-4 py-2 text-sm bg-accent-light dark:bg-accent-dark text-white disabled:opacity-50"
                    >
                      {processingId ===
                      requirement.id
                        ? "Creating..."
                        : "Create AI Modification Proposal"}
                    </button>
                  </div>
                )}

              </div>
            )
          )}

        </div>
      </section>

      {/* ================================================== */}
      {/* MODIFICATION REVIEW */}
      {/* ================================================== */}

      <section>
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-lg font-semibold">
              Modification Review
            </h2>

            <p className="text-sm opacity-50 mt-1">
              AI-generated proposals waiting for
              human approval.
            </p>
          </div>

          <span className="text-xs opacity-50">
            {
              modifications.filter(
                (modification) =>
                  modification.status ===
                  "PENDING_REVIEW"
              ).length
            }{" "}
            pending
          </span>
        </div>

        <div className="space-y-4">

          {modifications.length === 0 && (
            <div className="border border-dashed border-black/10 dark:border-white/10 rounded-xl p-10 text-center text-sm opacity-50">
              No modification proposals exist yet.
            </div>
          )}

          {modifications.map(
            (modification) => (
              <div
                key={modification.id}
                className="rounded-xl border border-black/10 dark:border-white/10 bg-surface-light dark:bg-surface-dark p-5"
              >

                <div className="flex items-start justify-between gap-4">

                  <h3 className="font-medium">
                    {modification.summary}
                  </h3>

                  <span className="text-xs rounded-full px-2.5 py-1 bg-black/5 dark:bg-white/5 shrink-0">
                    {modification.status}
                  </span>

                </div>

                {modification.implementationPlan.length >
                  0 && (
                  <div className="mt-5">
                    <p className="text-xs uppercase tracking-wide opacity-40 mb-2">
                      Proposed implementation
                    </p>

                    <ol className="space-y-2 text-sm">
                      {modification.implementationPlan.map(
                        (
                          step,
                          index
                        ) => (
                          <li
                            key={index}
                            className="flex gap-3"
                          >
                            <span className="opacity-40">
                              {index + 1}.
                            </span>

                            <span>
                              {step}
                            </span>
                          </li>
                        )
                      )}
                    </ol>
                  </div>
                )}

                {modification.affectedFiles.length >
                  0 && (
                  <div className="mt-5">
                    <p className="text-xs uppercase tracking-wide opacity-40 mb-2">
                      Affected files
                    </p>

                    <div className="flex flex-wrap gap-2">
                      {modification.affectedFiles.map(
                        (
                          file,
                          index
                        ) => (
                          <span
                            key={index}
                            className="text-xs rounded-md bg-black/5 dark:bg-white/5 px-2 py-1 font-mono"
                          >
                            {file}
                          </span>
                        )
                      )}
                    </div>
                  </div>
                )}

                {modification.status ===
                  "PENDING_REVIEW" && (
                  <div className="mt-6 pt-5 border-t border-black/10 dark:border-white/10">

                    <div className="text-xs opacity-50 mb-3">
                      Human review required before
                      implementation.
                    </div>

                    <div className="flex flex-wrap gap-2">

                      <button
                        disabled={
                          processingId ===
                          modification.id
                        }
                        onClick={() =>
                          review(
                            modification.id,
                            "ACCEPTED"
                          )
                        }
                        className="px-4 py-2 rounded-lg text-sm bg-green-500/10 text-green-600 dark:text-green-400 disabled:opacity-50"
                      >
                        Accept
                      </button>

                      <button
                        disabled={
                          processingId ===
                          modification.id
                        }
                        onClick={() =>
                          review(
                            modification.id,
                            "CHANGES_REQUESTED"
                          )
                        }
                        className="px-4 py-2 rounded-lg text-sm bg-yellow-500/10 text-yellow-600 dark:text-yellow-400 disabled:opacity-50"
                      >
                        Request Changes
                      </button>

                      <button
                        disabled={
                          processingId ===
                          modification.id
                        }
                        onClick={() =>
                          review(
                            modification.id,
                            "REJECTED"
                          )
                        }
                        className="px-4 py-2 rounded-lg text-sm bg-red-500/10 text-red-600 dark:text-red-400 disabled:opacity-50"
                      >
                        Reject
                      </button>

                    </div>
                  </div>
                )}

                {modification.reviewComment && (
                  <div className="mt-5 rounded-lg bg-black/5 dark:bg-white/5 p-4 text-sm">
                    <div className="text-xs opacity-50 mb-1">
                      Review comment
                    </div>

                    {modification.reviewComment}
                  </div>
                )}

              </div>
            )
          )}

        </div>
      </section>

      {/* ================================================== */}
      {/* SAFETY / WORKFLOW NOTICE */}
      {/* ================================================== */}

      <div className="rounded-xl border border-yellow-500/20 bg-yellow-500/5 p-5">

        <div className="font-medium">
          Human approval required
        </div>

        <p className="mt-1 text-sm opacity-70">
          AI proposals do not automatically modify,
          deploy, or publish a client application.
          An authorized staff member must review the
          proposal first.
        </p>

      </div>

    </div>
  );
}
