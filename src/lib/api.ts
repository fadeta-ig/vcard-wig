import { NextResponse } from "next/server";
import { ZodError } from "zod";

type FieldErrors = Record<string, string[]>;

export class AppError extends Error {
  readonly status: number;
  readonly code: string;
  readonly fieldErrors?: FieldErrors;
  readonly retryAfterSeconds?: number;

  constructor(
    status: number,
    code: string,
    message: string,
    options?: { fieldErrors?: FieldErrors; retryAfterSeconds?: number },
  ) {
    super(message);
    this.name = "AppError";
    this.status = status;
    this.code = code;
    this.fieldErrors = options?.fieldErrors;
    this.retryAfterSeconds = options?.retryAfterSeconds;
  }
}

export function successResponse<T>(data: T, status = 200): NextResponse {
  return NextResponse.json({ data }, { status });
}

export async function readBoundedBody(
  request: Request,
  maximumBytes = 64 * 1024,
): Promise<Uint8Array> {
  const declared = request.headers.get("content-length");
  if (
    declared &&
    (!/^\d+$/.test(declared) || Number(declared) > maximumBytes)
  ) {
    throw new AppError(
      413,
      "REQUEST_TOO_LARGE",
      "Ukuran permintaan melebihi batas yang diizinkan.",
    );
  }
  const reader = request.body?.getReader();
  if (!reader) return new Uint8Array();
  const chunks: Uint8Array[] = [];
  let total = 0;
  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      total += value.byteLength;
      if (total > maximumBytes) {
        await reader.cancel();
        throw new AppError(
          413,
          "REQUEST_TOO_LARGE",
          "Ukuran permintaan melebihi batas yang diizinkan.",
        );
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }
  const result = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    result.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return result;
}

export async function readFormBody(request: Request): Promise<FormData> {
  const body = await readBoundedBody(request, 2 * 1024 * 1024 + 64 * 1024);
  try {
    return await new Response(new Uint8Array(body), {
      headers: { "content-type": request.headers.get("content-type") ?? "" },
    }).formData();
  } catch {
    throw new AppError(400, "INVALID_FORM", "Format unggahan tidak valid.");
  }
}

export async function readJsonBody(
  request: Request,
  maximumBytes = 64 * 1024,
): Promise<unknown> {
  try {
    return JSON.parse(
      new TextDecoder("utf-8", { fatal: true }).decode(
        await readBoundedBody(request, maximumBytes),
      ),
    );
  } catch (error) {
    if (error instanceof AppError) throw error;
    throw new AppError(400, "INVALID_JSON", "Format JSON tidak valid.");
  }
}

function isPrismaUniqueError(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as { code?: string }).code === "P2002"
  );
}

function zodFieldErrors(error: ZodError): FieldErrors {
  const flattened = error.flatten().fieldErrors;
  return Object.fromEntries(
    Object.entries(flattened).filter((entry): entry is [string, string[]] =>
      Boolean(entry[1]),
    ),
  );
}

export function routeErrorResponse(error: unknown): NextResponse {
  if (error instanceof AppError) {
    const response = NextResponse.json(
      {
        error: {
          code: error.code,
          message: error.message,
          ...(error.fieldErrors ? { fields: error.fieldErrors } : {}),
        },
      },
      { status: error.status },
    );

    if (error.retryAfterSeconds) {
      response.headers.set("Retry-After", String(error.retryAfterSeconds));
    }

    return response;
  }

  if (error instanceof ZodError) {
    return NextResponse.json(
      {
        error: {
          code: "VALIDATION_ERROR",
          message: "Data yang dimasukkan belum valid.",
          fields: zodFieldErrors(error),
        },
      },
      { status: 422 },
    );
  }

  if (isPrismaUniqueError(error)) {
    return NextResponse.json(
      {
        error: {
          code: "CONFLICT",
          message: "Data yang sama sudah digunakan.",
        },
      },
      { status: 409 },
    );
  }

  const requestId = crypto.randomUUID();
  console.error("Unhandled route error", {
    requestId,
    type: error instanceof Error ? error.name : "UnknownError",
  });
  return NextResponse.json(
    {
      error: {
        code: "INTERNAL_ERROR",
        message: "Terjadi kesalahan internal. Silakan coba kembali.",
      },
    },
    { status: 500, headers: { "X-Request-ID": requestId } },
  );
}
