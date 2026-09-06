import { NextResponse } from "next/server";
import { DISCLAIMER, RULE_SETS, proposedItems } from "@/lib/tax/rules";

export async function GET() {
  return NextResponse.json({
    disclaimer: DISCLAIMER,
    ruleSets: RULE_SETS.map((r) => ({
      id: r.id,
      label: r.label,
      status: r.status,
      effectiveFrom: r.effectiveFrom,
      proposed: proposedItems(r),
    })),
  });
}
