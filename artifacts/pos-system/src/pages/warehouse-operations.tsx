import React from "react";
import { AdminLayout } from "@/components/admin-layout";
import { ErpWarehouseOperationsHub } from "@/components/erp-warehouse-operations-hub";

export default function WarehouseOperationsPage() {
  return (
    <AdminLayout>
      <div className="container mx-auto p-4 space-y-4">
        <ErpWarehouseOperationsHub />
      </div>
    </AdminLayout>
  );
}
