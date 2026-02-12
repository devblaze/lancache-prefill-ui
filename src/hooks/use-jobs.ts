"use client";

import { useState, useEffect, useCallback } from "react";

export interface JobGame {
  id: string;
  status: string;
  progress: number;
  game: {
    id: string;
    name: string;
    appId: string;
  };
}

export interface Job {
  id: string;
  toolId: string;
  status: string;
  startedAt: string | null;
  completedAt: string | null;
  createdAt: string;
  errorMessage: string | null;
  tool: {
    id: string;
    displayName: string;
  };
  games: JobGame[];
  _count?: {
    logs: number;
  };
}

export function useJobs() {
  const [jobs, setJobs] = useState<Job[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchJobs = useCallback(async () => {
    try {
      const response = await fetch("/api/jobs");
      if (response.ok) {
        const data = await response.json();
        setJobs(data);
      }
    } catch (error) {
      console.error("Failed to fetch jobs:", error);
    } finally {
      setLoading(false);
    }
  }, []);

  const createJob = async (
    toolId: string,
    gameIds: string[],
    flags?: { force?: boolean; verbose?: boolean }
  ) => {
    const response = await fetch("/api/jobs", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ toolId, gameIds, flags }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || "Failed to create job");
    }

    const job = await response.json();
    setJobs((prev) => [job, ...prev]);
    return job;
  };

  const cancelJob = async (jobId: string) => {
    const response = await fetch(`/api/jobs/${jobId}/cancel`, {
      method: "POST",
    });

    if (!response.ok) {
      throw new Error("Failed to cancel job");
    }

    await fetchJobs();
  };

  useEffect(() => {
    fetchJobs();
  }, [fetchJobs]);

  return { jobs, loading, createJob, cancelJob, refetch: fetchJobs };
}
