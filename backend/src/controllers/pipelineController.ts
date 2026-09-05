import { Request, Response, NextFunction } from "express";
import { supabase } from "../utils/supabaseClient";
import { ApiError } from "../middleware/errorHandler";
import { generatePipelineFromThread, updateStageTime, suggestPipelineTemplate } from "../services/pipelineService";

export async function getPipeline(req: Request, res: Response, next: NextFunction) {
  try {
    const { contactId } = req.params;
    const userId = req.auth!.userId;

    const { data, error } = await supabase
      .from("Pipeline")
      .select("*")
      .eq("contactId", contactId)
      .eq("userId", userId)
      .single();

    if (error) {
      return res.json({ exists: false, pipeline: null });
    }

    let totalDuration = 0;
    if (data.stages && data.stages.length > 0) {
      const completedStages = data.stages.filter((s: any) => s.status === 'complete');
      if (completedStages.length > 0) {
        totalDuration = completedStages.reduce((sum: number, s: any) => {
          if (s.startedAt && s.completedAt) {
            const start = new Date(s.startedAt);
            const end = new Date(s.completedAt);
            return sum + Math.round((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
          }
          return sum;
        }, 0);
      }
    }

    res.json({
      exists: true,
      pipeline: {
        ...data,
        userId,
        totalDuration,
      }
    });
  } catch (err) {
    next(err);
  }
}

export async function generatePipeline(req: Request, res: Response, next: NextFunction) {
  try {
    const { contactId } = req.params;
    const { threadId } = req.body;
    const userId = req.auth!.userId;

    if (!threadId) {
      throw new ApiError(400, "threadId is required");
    }

    const pipeline = await generatePipelineFromThread(userId, contactId, threadId);

    // ✅ Add dates to stages
    const now = new Date().toISOString();
    const stagesWithDates = pipeline.stages.map((stage, index) => ({
      ...stage,
      startedAt: index === 0 ? now : null,
      completedAt: null,
      dueDate: null,
      duration: 0,
      emailIds: [],
    }));

    const { data, error } = await supabase
      .from("Pipeline")
      .upsert({
        userId,
        contactId,
        contactName: pipeline.contactName,
        projectName: pipeline.projectName,
        projectType: pipeline.projectType,
        stages: stagesWithDates,
        status: 'active',
        updatedAt: now,
        createdAt: now,
      })
      .select()
      .single();

    if (error) {
      throw new ApiError(500, error.message);
    }

    res.json({ pipeline: data });
  } catch (err) {
    next(err);
  }
}

export async function updatePipeline(req: Request, res: Response, next: NextFunction) {
  try {
    const { contactId } = req.params;
    const { threadId } = req.body;
    const userId = req.auth!.userId;

    if (!threadId) {
      throw new ApiError(400, "threadId is required");
    }

    const pipeline = await generatePipelineFromThread(userId, contactId, threadId);

    // ✅ Preserve existing dates
    const { data: existing } = await supabase
      .from("Pipeline")
      .select("stages")
      .eq("contactId", contactId)
      .eq("userId", userId)
      .single();

    const existingStages = existing?.stages || [];
    const now = new Date().toISOString();

    const updatedStages = pipeline.stages.map((stage, index) => {
      const existing = existingStages.find((s: any) => s.name === stage.name);
      return {
        ...stage,
        startedAt: existing?.startedAt || (index === 0 ? now : null),
        completedAt: existing?.completedAt || null,
        dueDate: existing?.dueDate || null,
        duration: existing?.duration || 0,
        emailIds: existing?.emailIds || [],
      };
    });

    const { data, error } = await supabase
      .from("Pipeline")
      .update({
        projectName: pipeline.projectName,
        projectType: pipeline.projectType,
        stages: updatedStages,
        updatedAt: now,
      })
      .eq("contactId", contactId)
      .eq("userId", userId)
      .select()
      .single();

    if (error) {
      throw new ApiError(500, error.message);
    }

    res.json({ pipeline: data });
  } catch (err) {
    next(err);
  }
}

// ✅ NEW: Update individual stage
export async function updatePipelineStage(req: Request, res: Response, next: NextFunction) {
  try {
    const { pipelineId, stageId } = req.params;
    const { status } = req.body;
    const userId = req.auth!.userId;

    const { data: pipeline, error: fetchError } = await supabase
      .from("Pipeline")
      .select("*")
      .eq("id", pipelineId)
      .eq("userId", userId)
      .single();

    if (fetchError || !pipeline) {
      throw new ApiError(404, "Pipeline not found");
    }

    const stages = pipeline.stages.map((stage: any) => {
      if (stage.id === stageId) {
        const now = new Date().toISOString();
        return {
          ...stage,
          status,
          completedAt: status === 'complete' ? now : stage.completedAt,
          startedAt: status === 'in-progress' && !stage.startedAt ? now : stage.startedAt,
        };
      }
      return stage;
    });

    const { data, error } = await supabase
      .from("Pipeline")
      .update({ stages, updatedAt: new Date().toISOString() })
      .eq("id", pipelineId)
      .eq("userId", userId)
      .select()
      .single();

    if (error) {
      throw new ApiError(500, error.message);
    }

    res.json({ success: true, stage: data.stages.find((s: any) => s.id === stageId) });
  } catch (err) {
    next(err);
  }
}

// ✅ NEW: Get pipeline metrics
export async function getPipelineMetrics(req: Request, res: Response, next: NextFunction) {
  try {
    const userId = req.auth!.userId;

    const { data: pipelines, error } = await supabase
      .from("Pipeline")
      .select("*")
      .eq("userId", userId);

    if (error) {
      throw new ApiError(500, error.message);
    }

    const active = pipelines.filter((p: any) => p.status === 'active');
    const completed = pipelines.filter((p: any) => p.status === 'completed');
    const total = pipelines.length;

    // Calculate average completion time
    let totalDuration = 0;
    let completedCount = 0;
    const bottleneckStages: Record<string, { total: number; count: number }> = {};
    const durationByType: Record<string, { total: number; count: number }> = {};
    const monthlyTrends: Record<string, { completed: number; started: number }> = {};

    for (const pipeline of pipelines) {
      // Duration by type
      if (!durationByType[pipeline.projectType]) {
        durationByType[pipeline.projectType] = { total: 0, count: 0 };
      }

      const completedStages = pipeline.stages.filter((s: any) => s.status === 'complete');
      let pipelineDuration = 0;

      for (const stage of pipeline.stages) {
        if (stage.startedAt && stage.completedAt) {
          const start = new Date(stage.startedAt);
          const end = new Date(stage.completedAt);
          const duration = Math.round((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
          pipelineDuration += duration;

          // Track bottleneck
          if (!bottleneckStages[stage.name]) {
            bottleneckStages[stage.name] = { total: 0, count: 0 };
          }
          bottleneckStages[stage.name].total += duration;
          bottleneckStages[stage.name].count += 1;
        }
      }

      if (pipeline.status === 'completed') {
        totalDuration += pipelineDuration;
        completedCount++;
      }

      durationByType[pipeline.projectType].total += pipelineDuration;
      durationByType[pipeline.projectType].count += 1;

      // Monthly trends
      if (pipeline.createdAt) {
        const month = new Date(pipeline.createdAt).toLocaleString('default', { month: 'short', year: 'numeric' });
        if (!monthlyTrends[month]) {
          monthlyTrends[month] = { completed: 0, started: 0 };
        }
        monthlyTrends[month].started += 1;
        if (pipeline.status === 'completed') {
          monthlyTrends[month].completed += 1;
        }
      }
    }

    // Calculate averages
    const avgCompletionDays = completedCount > 0 ? Math.round(totalDuration / completedCount) : 0;

    // Process bottlenecks
    const bottleneckList = Object.entries(bottleneckStages)
      .map(([name, data]) => ({
        name,
        avgDuration: Math.round(data.total / data.count),
        count: data.count,
      }))
      .sort((a, b) => b.avgDuration - a.avgDuration)
      .slice(0, 5);

    // Process duration by type
    const avgDurationByType: Record<string, number> = {};
    for (const [type, data] of Object.entries(durationByType)) {
      avgDurationByType[type] = Math.round(data.total / data.count);
    }

    // Process monthly trends
    const monthlyTrendsList = Object.entries(monthlyTrends)
      .map(([month, data]) => ({ month, ...data }))
      .sort((a, b) => a.month.localeCompare(b.month))
      .slice(-12);

    res.json({
      avgCompletionDays,
      successRate: total > 0 ? Math.round((completedCount / total) * 100) : 0,
      activeCount: active.length,
      completedCount,
      totalCount: total,
      bottleneckStages: bottleneckList,
      avgDurationByType,
      monthlyTrends: monthlyTrendsList,
    });
  } catch (err) {
    next(err);
  }
}


// ✅ NEW: Update pipeline stages (for drag & drop reordering)
export async function updatePipelineStages(req: Request, res: Response, next: NextFunction) {
  try {
    const { pipelineId } = req.params;
    const { stages } = req.body;
    const userId = req.auth!.userId;

    const { data, error } = await supabase
      .from("Pipeline")
      .update({
        stages,
        updatedAt: new Date().toISOString(),
      })
      .eq("id", pipelineId)
      .eq("userId", userId)
      .select()
      .single();

    if (error) {
      throw new ApiError(500, error.message);
    }

    res.json({ success: true });
  } catch (err) {
    next(err);
  }
}

// ✅ NEW: Get pipeline notifications
export async function getPipelineNotifications(req: Request, res: Response, next: NextFunction) {
  try {
    const userId = req.auth!.userId;

    const { data: pipelines, error } = await supabase
      .from("Pipeline")
      .select("*")
      .eq("userId", userId)
      .eq("status", "active");

    if (error) {
      throw new ApiError(500, error.message);
    }

    const overdue: any[] = [];
    const stuck: any[] = [];

    for (const pipeline of pipelines) {
      for (const stage of pipeline.stages) {
        // Check overdue
        if (stage.status !== 'complete' && stage.dueDate) {
          const dueDate = new Date(stage.dueDate);
          const now = new Date();
          const daysOverdue = Math.round((now.getTime() - dueDate.getTime()) / (1000 * 60 * 60 * 24));
          if (daysOverdue > 0) {
            overdue.push({
              pipelineId: pipeline.id,
              projectName: pipeline.projectName,
              stageName: stage.name,
              daysOverdue,
            });
          }
        }

        // Check stuck
        if (stage.status === 'in-progress' && stage.startedAt) {
          const started = new Date(stage.startedAt);
          const now = new Date();
          const daysInProgress = Math.round((now.getTime() - started.getTime()) / (1000 * 60 * 60 * 24));
          if (daysInProgress > 14) {
            stuck.push({
              pipelineId: pipeline.id,
              projectName: pipeline.projectName,
              stageName: stage.name,
              daysInProgress,
            });
          }
        }
      }
    }

    res.json({ overdue, stuck });
  } catch (err) {
    next(err);
  }
}

export async function updateStageTimeTracking(req: Request, res: Response, next: NextFunction) {
  try {
    const { pipelineId, stageId } = req.params;
    const { action, note } = req.body;
    const userId = req.auth!.userId;

    // Verify ownership
    const { data: pipeline, error: fetchError } = await supabase
      .from("Pipeline")
      .select("id")
      .eq("id", pipelineId)
      .eq("userId", userId)
      .single();

    if (fetchError || !pipeline) {
      throw new ApiError(404, "Pipeline not found");
    }

    const stages = await updateStageTime(pipelineId, stageId, action, note);
    
    res.json({ success: true, stages });
  } catch (err) {
    next(err);
  }
}

export async function suggestPipelineTemplate(req: Request, res: Response, next: NextFunction) {
  try {
    const { conversation } = req.body;
    if (!conversation) {
      throw new ApiError(400, "conversation is required");
    }

    const result = await suggestPipelineTemplate(conversation);
    res.json({ template: result });
  } catch (err) {
    next(err);
  }
}