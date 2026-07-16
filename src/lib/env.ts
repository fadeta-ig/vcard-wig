import { z } from "zod";

const environmentSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  DATABASE_HOST: z.string().min(1),
  DATABASE_PORT: z.coerce.number().int().min(1).max(65535),
  DATABASE_USER: z.string().min(1),
  DATABASE_PASSWORD: z.string(),
  DATABASE_NAME: z.string().min(1),
  DATABASE_CONNECTION_LIMIT: z.coerce.number().int().min(1).max(50).default(5),
  APP_URL: z.url(),
  NEXT_PUBLIC_APP_URL: z.url(),
  SESSION_TTL_HOURS: z.coerce.number().int().min(1).max(168).default(8),
  ANALYTICS_RETENTION_DAYS: z.coerce.number().int().min(30).max(3650).default(365),
  EXPIRED_SESSION_RETENTION_DAYS: z.coerce.number().int().min(1).max(365).default(30),
});

export type AppEnvironment = z.infer<typeof environmentSchema>;

let cachedEnvironment: AppEnvironment | undefined;

export function getEnvironment(): AppEnvironment {
  if (cachedEnvironment) {
    return cachedEnvironment;
  }

  // Keep server configuration runtime-bound. Direct `process.env.NAME` reads
  // can be substituted during a Next.js production build, which would bind a
  // promoted artifact to the build machine's database and origin.
  const runtimeEnvironment = process.env;

  const result = environmentSchema.safeParse({
    NODE_ENV: runtimeEnvironment.NODE_ENV,
    DATABASE_HOST: runtimeEnvironment.DATABASE_HOST,
    DATABASE_PORT: runtimeEnvironment.DATABASE_PORT,
    DATABASE_USER: runtimeEnvironment.DATABASE_USER,
    DATABASE_PASSWORD: runtimeEnvironment.DATABASE_PASSWORD ?? "",
    DATABASE_NAME: runtimeEnvironment.DATABASE_NAME,
    DATABASE_CONNECTION_LIMIT: runtimeEnvironment.DATABASE_CONNECTION_LIMIT,
    APP_URL: runtimeEnvironment.APP_URL,
    NEXT_PUBLIC_APP_URL: runtimeEnvironment.NEXT_PUBLIC_APP_URL,
    SESSION_TTL_HOURS: runtimeEnvironment.SESSION_TTL_HOURS,
    ANALYTICS_RETENTION_DAYS: runtimeEnvironment.ANALYTICS_RETENTION_DAYS,
    EXPIRED_SESSION_RETENTION_DAYS: runtimeEnvironment.EXPIRED_SESSION_RETENTION_DAYS,
  });

  if (!result.success) {
    const fields = result.error.issues.map((issue) => issue.path.join(".")).join(", ");
    throw new Error(`Konfigurasi environment tidak valid: ${fields}`);
  }

  cachedEnvironment = result.data;
  return cachedEnvironment;
}

export function resetEnvironmentForTests(): void {
  cachedEnvironment = undefined;
}
