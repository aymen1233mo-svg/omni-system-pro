import React from "react";
import { AdminLayout } from "@/components/admin-layout";
import { ErpInventoryVariablesPanel } from "@/components/erp-inventory-variables";

export default function InventoryVariablesPage() {
  return (
    <AdminLayout>
      <div className="p-4 md:p-6 max-w-7xl mx-auto space-y-6">
        <ErpInventoryVariablesPanel />
      </div>
    </AdminLayout>
  );
}
