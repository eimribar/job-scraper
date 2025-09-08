import { TierOneClient } from "./tier-one-client";

export const dynamic = 'force-dynamic';

export default async function TierOnePage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-blue-50/20">
      {/* Page Header */}
      <div className="border-b bg-white/70 backdrop-blur-md">
        <div className="container mx-auto px-6 py-6">
          <div>
            <h1 className="text-2xl font-bold text-slate-900">
              Tier 1 Companies Overview
            </h1>
            <p className="text-sm text-muted-foreground mt-1">
              Complete view of all 188 priority target companies
            </p>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="container mx-auto px-6 py-6">
        <TierOneClient />
      </div>
    </div>
  );
}