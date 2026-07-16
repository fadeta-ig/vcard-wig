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

export async function readJsonBody(request: Request): Promise<unknown> {
  try {
    return await request.json();
  } catch {
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
    Object.entries(flattened).filter((entry): entry is [string, string[]] => Boolean(entry[1])),
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

  console.error("Unhandled route error", error);
  return NextResponse.json(
    {
      error: {
        code: "INTERNAL_ERROR",
        message: "Terjadi kesalahan internal. Silakan coba kembali.",
      },
    },
    { status: 500 },
  );
}
