import type { RunType } from "./content";

export type ServerPlan = {
  runType: RunType;
  label: string;
  memoryMiB: number;
  swapMiB: number;
  diskMiB: number;
  cpuPercent: number;
  allocations: number;
  databases: number;
  backups: number;
  schedules: number;
};

// The free tiers described on the site. Keep every Calagopus resource number
// here so a plan change is one edit, not a hunt through the provisioning code.
// Calagopus reads cpu as percent of one core (100 = one thread) and memory and
// disk in MiB.
export const SERVER_PLANS: Record<RunType, ServerPlan> = {
  vanilla: {
    runType: "vanilla",
    label: "Vanilla",
    memoryMiB: 2048,
    swapMiB: 0,
    diskMiB: 10240,
    cpuPercent: 200,
    allocations: 1,
    databases: 0,
    backups: 1,
    schedules: 1,
  },
  plugins: {
    runType: "plugins",
    label: "Paper",
    memoryMiB: 2048,
    swapMiB: 0,
    diskMiB: 10240,
    cpuPercent: 200,
    allocations: 1,
    databases: 0,
    backups: 1,
    schedules: 1,
  },
  modpack: {
    runType: "modpack",
    label: "Modpack",
    memoryMiB: 3072,
    swapMiB: 0,
    diskMiB: 10240,
    cpuPercent: 300,
    allocations: 1,
    databases: 0,
    backups: 1,
    schedules: 1,
  },
};

export function planFor(runType: RunType): ServerPlan {
  return SERVER_PLANS[runType] ?? SERVER_PLANS.vanilla;
}

export function describePlan(plan: ServerPlan): string {
  return `${Math.round(plan.memoryMiB / 1024)} GB RAM · ${plan.label}`;
}
