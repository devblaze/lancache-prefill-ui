import { JobsList } from "@/components/jobs/jobs-list";

export default function JobsPage() {
  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold">Prefill Jobs</h1>
        <p className="text-zinc-600 dark:text-zinc-400">
          View and manage prefill job history
        </p>
      </div>

      <JobsList />
    </div>
  );
}
