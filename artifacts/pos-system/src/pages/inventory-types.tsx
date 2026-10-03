import React from "react";
import { AdminLayout } from "@/components/admin-layout";
import { ErpInventoryTransactionTypesScreen } from "@/components/erp-inventory-transaction-types";

export default function InventoryTransactionTypesPage() {
  return (
    <AdminLayout>
      <div className="p-4 md:p-6 max-w-7xl mx-auto space-y-6">
        <ErpInventoryTransactionTypesScreen />
      </div>
    </AdminLayout>
  );
}
