export const METRICS_KEY = "datagen:metrics";
export const jobsHashKey = () => "datagen:jobs";
export const jobPeersHashKey = (jobId: string) => `datagen:job:${jobId}:peers`;
export const userJobsKey = (username: string) => `datagen:user:${username}:jobs`;
export const usersIndexKey = () => "datagen:users";
export const userEmailIndexKey = () => "datagen:user-email-index";
export const registerMailFailuresKey = () => "datagen:register-mail-failures";
export const userSettingsKey = (username: string) =>
  `datagen:user:${username}:settings`;
