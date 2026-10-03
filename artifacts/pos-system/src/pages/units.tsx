import React from "react";
import { AdminLayout } from "@/components/admin-layout";
import { ErpUnitsScreen } from "@/components/erp-units-screen";

export default function UnitsPage() {
  return (
    <AdminLayout>
      <div className="p-4 md:p-6 max-w-7xl mx-auto space-y-6">
        <ErpUnitsScreen />
      </div>
    </AdminLayout>
  );
}
