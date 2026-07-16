import type { NextRequest } from "next/server";
import { routeErrorResponse } from "@/lib/api";
import {
  analyticsCsv,
  getAnalyticsReport,
  parseAnalyticsFilters,
  resolveAnalyticsScope,
} from "@/services/analytics.service";
import { resolveSelectedCompany } from "@/services/authorization.service";
import { requireRequestSession } from "@/services/auth.service";

export async function GET(request: NextRequest) {
  try {
    const session = await requireRequestSession(request);
    const selectedCompany = await resolveSelectedCompany(session);
    const input = Object.fromEntries(request.nextUrl.searchParams.entries());
    const scope = resolveAnalyticsScope(session, selectedCompany, input.scope);
    const filters = parseAnalyticsFilters(input);
    const report = await getAnalyticsReport(scope, filters, { allRows: true });
    const response = new Response(analyticsCsv(report.rows), {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="analytics-${filters.fromInput}-${filters.toInput}.csv"`,
        "Cache-Control": "private, no-store, max-age=0",
        "X-Content-Type-Options": "nosniff",
      },
    });
    return response;
  } catch (error) {
    return routeErrorResponse(error);
  }
}

