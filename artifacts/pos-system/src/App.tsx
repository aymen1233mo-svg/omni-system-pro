import { Switch, Route, Router as WouterRouter } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider, ProtectedRoute, useAuth } from "@/components/auth-provider";
import NotFound from "@/pages/not-found";
import Login from "@/pages/login";
import Pos from "@/pages/pos";
import Dashboard from "@/pages/dashboard";
import Products from "@/pages/products";
import Categories from "@/pages/categories";
import Orders from "@/pages/orders";
import Customers from "@/pages/customers";
import Users from "@/pages/users";
import Reports from "@/pages/reports";
import Settings from "@/pages/settings";
import PrintLog from "@/pages/print-log";
import HR from "@/pages/hr";
import Returns from "@/pages/returns";
import Accounting from "@/pages/accounting";
import DocumentPrintSettingsPage from "@/pages/document-print-settings";
import OnyxErp from "@/pages/onyx-erp";
import Licenses from "@/pages/licenses";
import Suppliers from "@/pages/suppliers";
import Expenses from "@/pages/expenses";
import Inventory from "@/pages/inventory";
import Branches from "@/pages/branches";
import Tables from "@/pages/tables";
import Shifts from "@/pages/shifts";
import Currencies from "@/pages/currencies";
import Audit from "@/pages/audit";
import SystemGuidePage from "@/pages/system-guide";
import BrochuresPage from "./pages/brochures";
import WarehouseSalesInvoices from "./pages/sales-invoices";
import InventoryVariablesPage from "./pages/inventory-variables";
import UnitsPage from "./pages/units";
import ItemTypesPage from "./pages/item-types";
import InventoryTransactionTypesPage from "./pages/inventory-types";
import ItemGroupsPage from "./pages/item-groups";
import WarehouseOperationsPage from "./pages/warehouse-operations";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      retry: 1,
    },
  },
});

import BackupRestorePage from "./pages/backup-restore";
import CashierStatement from "./pages/cashier-statement";
import TravelDashboardPage from "./pages/travel-dashboard";
import PassengersPage from "./pages/passengers";
import TravelBookingsPage from "./pages/travel-bookings";
import TravelVisasPage from "./pages/travel-visas";
import TravelHotelsPage from "./pages/travel-hotels";
import TravelDocumentsPage from "./pages/travel-documents";
import TravelAirlinesPage from "./pages/travel-airlines";
import TravelAirportsPage from "./pages/travel-airports";
import TravelHotelsDbPage from "./pages/travel-hotels-db";
import TravelRefundsPage from "./pages/travel-refunds";
import TravelModificationsPage from "./pages/travel-modifications";
import TravelPackagesPage from "./pages/travel-packages";
import TravelTransportPage from "./pages/travel-transport";
import TravelBusTicketsPage from "./pages/travel-bus-tickets";
import TravelInsurancePage from "./pages/travel-insurance";
import TravelSuppliersPage from "./pages/travel-suppliers";
import TravelInvoicesPage from "./pages/travel-invoices";
import TravelQuotationsPage from "./pages/travel-quotations";
import TravelProcurementPage from "./pages/travel-procurement";
import TravelCommissionsPage from "./pages/travel-commissions";
import TravelReportsPage from "./pages/travel-reports";
import TravelDailyOperationsPage from "./pages/travel-daily-operations";
import TravelTasksPage from "./pages/travel-tasks";
import TravelSettingsPage from "./pages/travel-settings";
import TravelWizardBookingPage from "./pages/travel-wizard-booking";
import TravelApprovalsPage from "./pages/travel-approvals";
import TravelBranchesHubPage from "./pages/travel-branches-hub";
import TravelManagerDashboardPage from "./pages/travel-manager-dashboard";
import TravelGdsTerminalPage from "./pages/travel-gds-terminal";
import TravelB2bPortalPage from "./pages/travel-b2b-portal";
import TravelB2cPortalPage from "./pages/travel-b2c-portal";
import TravelBspReconciliationPage from "./pages/travel-bsp-reconciliation";
import TravelNotificationsHubPage from "./pages/travel-notifications-hub";
import TravelAtbPrintingPage from "./pages/travel-atb-printing";
import TravelNdcHubPage from "./pages/travel-ndc-hub";
import TravelHotelAggregatorPage from "./pages/travel-hotel-aggregator";
import TravelCharterAllotmentsPage from "./pages/travel-charter-allotments";
import TravelZatcaCompliancePage from "./pages/travel-zatca-compliance";
import TravelVccPaymentsPage from "./pages/travel-vcc-payments";
import TravelSmartItineraryPage from "./pages/travel-smart-itinerary";

function HomeRedirect() {
  const { user } = useAuth();
  const role = (user?.role as string) || "";
  const isDevOrAdmin = role === "admin" || role === "developer" || role === "general_manager" || Boolean((user as any)?.is_system_admin);
  const isPosOnly = !isDevOrAdmin && (Boolean((user as any)?.perm_pos_only) || role === "cashier" || role === "كاشير" || (user as any)?.default_screen === "pos");
  if (isPosOnly) {
    return <Pos />;
  }
  return <Dashboard />;
}

function Router() {
  return (
    <Switch>
      <Route path="/login" component={Login} />
      <Route path="/travel-dashboard">
        <ProtectedRoute requireAdmin><TravelDashboardPage /></ProtectedRoute>
      </Route>
      <Route path="/travel">
        <ProtectedRoute requireAdmin><TravelDashboardPage /></ProtectedRoute>
      </Route>
      <Route path="/travel/dashboard">
        <ProtectedRoute requireAdmin><TravelDashboardPage /></ProtectedRoute>
      </Route>
      <Route path="/travel-operations">
        <ProtectedRoute requireAdmin><TravelDailyOperationsPage /></ProtectedRoute>
      </Route>
      <Route path="/travel/operations">
        <ProtectedRoute requireAdmin><TravelDailyOperationsPage /></ProtectedRoute>
      </Route>
      <Route path="/travel-tasks">
        <ProtectedRoute requireAdmin><TravelTasksPage /></ProtectedRoute>
      </Route>
      <Route path="/travel/tasks">
        <ProtectedRoute requireAdmin><TravelTasksPage /></ProtectedRoute>
      </Route>
      <Route path="/travel-settings">
        <ProtectedRoute requireAdmin><TravelSettingsPage /></ProtectedRoute>
      </Route>
      <Route path="/travel/settings">
        <ProtectedRoute requireAdmin><TravelSettingsPage /></ProtectedRoute>
      </Route>
      <Route path="/passengers">
        <ProtectedRoute requireAdmin><PassengersPage /></ProtectedRoute>
      </Route>
      <Route path="/travel/passengers">
        <ProtectedRoute requireAdmin><PassengersPage /></ProtectedRoute>
      </Route>
      <Route path="/travel-documents">
        <ProtectedRoute requireAdmin><TravelDocumentsPage /></ProtectedRoute>
      </Route>
      <Route path="/travel/documents">
        <ProtectedRoute requireAdmin><TravelDocumentsPage /></ProtectedRoute>
      </Route>
      <Route path="/travel-airlines">
        <ProtectedRoute requireAdmin><TravelAirlinesPage /></ProtectedRoute>
      </Route>
      <Route path="/travel/airlines">
        <ProtectedRoute requireAdmin><TravelAirlinesPage /></ProtectedRoute>
      </Route>
      <Route path="/travel-airports">
        <ProtectedRoute requireAdmin><TravelAirportsPage /></ProtectedRoute>
      </Route>
      <Route path="/travel/airports">
        <ProtectedRoute requireAdmin><TravelAirportsPage /></ProtectedRoute>
      </Route>
      <Route path="/travel-hotels-db">
        <ProtectedRoute requireAdmin><TravelHotelsDbPage /></ProtectedRoute>
      </Route>
      <Route path="/travel/hotels-db">
        <ProtectedRoute requireAdmin><TravelHotelsDbPage /></ProtectedRoute>
      </Route>
      <Route path="/travel/hotels-catalog">
        <ProtectedRoute requireAdmin><TravelHotelsDbPage /></ProtectedRoute>
      </Route>
      <Route path="/travel-bookings">
        <ProtectedRoute requireAdmin><TravelBookingsPage /></ProtectedRoute>
      </Route>
      <Route path="/travel/bookings">
        <ProtectedRoute requireAdmin><TravelBookingsPage /></ProtectedRoute>
      </Route>
      <Route path="/travel-wizard">
        <ProtectedRoute requireAdmin><TravelWizardBookingPage /></ProtectedRoute>
      </Route>
      <Route path="/travel/wizard">
        <ProtectedRoute requireAdmin><TravelWizardBookingPage /></ProtectedRoute>
      </Route>
      <Route path="/travel-approvals">
        <ProtectedRoute requireAdmin><TravelApprovalsPage /></ProtectedRoute>
      </Route>
      <Route path="/travel/approvals">
        <ProtectedRoute requireAdmin><TravelApprovalsPage /></ProtectedRoute>
      </Route>
      <Route path="/travel-branches-hub">
        <ProtectedRoute requireAdmin><TravelBranchesHubPage /></ProtectedRoute>
      </Route>
      <Route path="/travel/branches">
        <ProtectedRoute requireAdmin><TravelBranchesHubPage /></ProtectedRoute>
      </Route>
      <Route path="/travel/branches-hub">
        <ProtectedRoute requireAdmin><TravelBranchesHubPage /></ProtectedRoute>
      </Route>
      <Route path="/travel-manager-dashboard">
        <ProtectedRoute requireAdmin><TravelManagerDashboardPage /></ProtectedRoute>
      </Route>
      <Route path="/travel/manager">
        <ProtectedRoute requireAdmin><TravelManagerDashboardPage /></ProtectedRoute>
      </Route>
      <Route path="/travel/manager-dashboard">
        <ProtectedRoute requireAdmin><TravelManagerDashboardPage /></ProtectedRoute>
      </Route>
      <Route path="/travel-refunds">
        <ProtectedRoute requireAdmin><TravelRefundsPage /></ProtectedRoute>
      </Route>
      <Route path="/travel/refunds">
        <ProtectedRoute requireAdmin><TravelRefundsPage /></ProtectedRoute>
      </Route>
      <Route path="/travel-modifications">
        <ProtectedRoute requireAdmin><TravelModificationsPage /></ProtectedRoute>
      </Route>
      <Route path="/travel/modifications">
        <ProtectedRoute requireAdmin><TravelModificationsPage /></ProtectedRoute>
      </Route>
      <Route path="/travel-visas">
        <ProtectedRoute requireAdmin><TravelVisasPage /></ProtectedRoute>
      </Route>
      <Route path="/travel/visas">
        <ProtectedRoute requireAdmin><TravelVisasPage /></ProtectedRoute>
      </Route>
      <Route path="/travel-hotels">
        <ProtectedRoute requireAdmin><TravelHotelsPage /></ProtectedRoute>
      </Route>
      <Route path="/travel/hotels">
        <ProtectedRoute requireAdmin><TravelHotelsPage /></ProtectedRoute>
      </Route>
      <Route path="/travel-tours">
        <ProtectedRoute requireAdmin><TravelPackagesPage /></ProtectedRoute>
      </Route>
      <Route path="/travel/tours">
        <ProtectedRoute requireAdmin><TravelPackagesPage /></ProtectedRoute>
      </Route>
      <Route path="/travel-packages">
        <ProtectedRoute requireAdmin><TravelPackagesPage /></ProtectedRoute>
      </Route>
      <Route path="/travel/packages">
        <ProtectedRoute requireAdmin><TravelPackagesPage /></ProtectedRoute>
      </Route>
      <Route path="/travel-transport">
        <ProtectedRoute requireAdmin><TravelTransportPage /></ProtectedRoute>
      </Route>
      <Route path="/travel/transport">
        <ProtectedRoute requireAdmin><TravelTransportPage /></ProtectedRoute>
      </Route>
      <Route path="/travel-bus-tickets">
        <ProtectedRoute requireAdmin><TravelBusTicketsPage /></ProtectedRoute>
      </Route>
      <Route path="/travel/bus-tickets">
        <ProtectedRoute requireAdmin><TravelBusTicketsPage /></ProtectedRoute>
      </Route>
      <Route path="/travel-bus-bookings">
        <ProtectedRoute requireAdmin><TravelBusTicketsPage /></ProtectedRoute>
      </Route>
      <Route path="/travel/bus-bookings">
        <ProtectedRoute requireAdmin><TravelBusTicketsPage /></ProtectedRoute>
      </Route>
      <Route path="/travel/buses">
        <ProtectedRoute requireAdmin><TravelBusTicketsPage /></ProtectedRoute>
      </Route>
      <Route path="/travel-insurance">
        <ProtectedRoute requireAdmin><TravelInsurancePage /></ProtectedRoute>
      </Route>
      <Route path="/travel/insurance">
        <ProtectedRoute requireAdmin><TravelInsurancePage /></ProtectedRoute>
      </Route>
      <Route path="/travel-suppliers">
        <ProtectedRoute requireAdmin><TravelSuppliersPage /></ProtectedRoute>
      </Route>
      <Route path="/travel/suppliers">
        <ProtectedRoute requireAdmin><TravelSuppliersPage /></ProtectedRoute>
      </Route>
      <Route path="/travel-invoices">
        <ProtectedRoute requireAdmin><TravelInvoicesPage /></ProtectedRoute>
      </Route>
      <Route path="/travel/invoices">
        <ProtectedRoute requireAdmin><TravelInvoicesPage /></ProtectedRoute>
      </Route>
      <Route path="/travel-quotations">
        <ProtectedRoute requireAdmin><TravelQuotationsPage /></ProtectedRoute>
      </Route>
      <Route path="/travel/quotations">
        <ProtectedRoute requireAdmin><TravelQuotationsPage /></ProtectedRoute>
      </Route>
      <Route path="/travel-procurement">
        <ProtectedRoute requireAdmin><TravelProcurementPage /></ProtectedRoute>
      </Route>
      <Route path="/travel/procurement">
        <ProtectedRoute requireAdmin><TravelProcurementPage /></ProtectedRoute>
      </Route>
      <Route path="/travel-commissions">
        <ProtectedRoute requireAdmin><TravelCommissionsPage /></ProtectedRoute>
      </Route>
      <Route path="/travel/commissions">
        <ProtectedRoute requireAdmin><TravelCommissionsPage /></ProtectedRoute>
      </Route>
      <Route path="/travel-reports">
        <ProtectedRoute requireAdmin><TravelReportsPage /></ProtectedRoute>
      </Route>
      <Route path="/travel/reports">
        <ProtectedRoute requireAdmin><TravelReportsPage /></ProtectedRoute>
      </Route>
      <Route path="/travel-gds-terminal">
        <ProtectedRoute requireAdmin><TravelGdsTerminalPage /></ProtectedRoute>
      </Route>
      <Route path="/travel/gds">
        <ProtectedRoute requireAdmin><TravelGdsTerminalPage /></ProtectedRoute>
      </Route>
      <Route path="/travel/gds-terminal">
        <ProtectedRoute requireAdmin><TravelGdsTerminalPage /></ProtectedRoute>
      </Route>
      <Route path="/travel-b2b-portal">
        <ProtectedRoute requireAdmin><TravelB2bPortalPage /></ProtectedRoute>
      </Route>
      <Route path="/travel/b2b">
        <ProtectedRoute requireAdmin><TravelB2bPortalPage /></ProtectedRoute>
      </Route>
      <Route path="/travel/b2b-portal">
        <ProtectedRoute requireAdmin><TravelB2bPortalPage /></ProtectedRoute>
      </Route>
      <Route path="/travel-b2c-portal">
        <ProtectedRoute requireAdmin><TravelB2cPortalPage /></ProtectedRoute>
      </Route>
      <Route path="/travel/b2c">
        <ProtectedRoute requireAdmin><TravelB2cPortalPage /></ProtectedRoute>
      </Route>
      <Route path="/travel/b2c-portal">
        <ProtectedRoute requireAdmin><TravelB2cPortalPage /></ProtectedRoute>
      </Route>
      <Route path="/travel-bsp-reconciliation">
        <ProtectedRoute requireAdmin><TravelBspReconciliationPage /></ProtectedRoute>
      </Route>
      <Route path="/travel/bsp">
        <ProtectedRoute requireAdmin><TravelBspReconciliationPage /></ProtectedRoute>
      </Route>
      <Route path="/travel/bsp-reconciliation">
        <ProtectedRoute requireAdmin><TravelBspReconciliationPage /></ProtectedRoute>
      </Route>
      <Route path="/travel-notifications-hub">
        <ProtectedRoute requireAdmin><TravelNotificationsHubPage /></ProtectedRoute>
      </Route>
      <Route path="/travel/notifications">
        <ProtectedRoute requireAdmin><TravelNotificationsHubPage /></ProtectedRoute>
      </Route>
      <Route path="/travel/notifications-hub">
        <ProtectedRoute requireAdmin><TravelNotificationsHubPage /></ProtectedRoute>
      </Route>
      <Route path="/travel-atb-printing">
        <ProtectedRoute requireAdmin><TravelAtbPrintingPage /></ProtectedRoute>
      </Route>
      <Route path="/travel/atb-printing">
        <ProtectedRoute requireAdmin><TravelAtbPrintingPage /></ProtectedRoute>
      </Route>
      <Route path="/travel/atb">
        <ProtectedRoute requireAdmin><TravelAtbPrintingPage /></ProtectedRoute>
      </Route>
      <Route path="/travel-ndc-hub">
        <ProtectedRoute requireAdmin><TravelNdcHubPage /></ProtectedRoute>
      </Route>
      <Route path="/travel/ndc">
        <ProtectedRoute requireAdmin><TravelNdcHubPage /></ProtectedRoute>
      </Route>
      <Route path="/travel-hotel-aggregator">
        <ProtectedRoute requireAdmin><TravelHotelAggregatorPage /></ProtectedRoute>
      </Route>
      <Route path="/travel/hotel-aggregator">
        <ProtectedRoute requireAdmin><TravelHotelAggregatorPage /></ProtectedRoute>
      </Route>
      <Route path="/travel/markup-rules">
        <ProtectedRoute requireAdmin><TravelHotelAggregatorPage /></ProtectedRoute>
      </Route>
      <Route path="/travel-charter-allotments">
        <ProtectedRoute requireAdmin><TravelCharterAllotmentsPage /></ProtectedRoute>
      </Route>
      <Route path="/travel/charter">
        <ProtectedRoute requireAdmin><TravelCharterAllotmentsPage /></ProtectedRoute>
      </Route>
      <Route path="/travel/allotments">
        <ProtectedRoute requireAdmin><TravelCharterAllotmentsPage /></ProtectedRoute>
      </Route>
      <Route path="/travel-zatca-compliance">
        <ProtectedRoute requireAdmin><TravelZatcaCompliancePage /></ProtectedRoute>
      </Route>
      <Route path="/travel/zatca">
        <ProtectedRoute requireAdmin><TravelZatcaCompliancePage /></ProtectedRoute>
      </Route>
      <Route path="/travel-vcc-payments">
        <ProtectedRoute requireAdmin><TravelVccPaymentsPage /></ProtectedRoute>
      </Route>
      <Route path="/travel/vcc">
        <ProtectedRoute requireAdmin><TravelVccPaymentsPage /></ProtectedRoute>
      </Route>
      <Route path="/travel-smart-itinerary">
        <ProtectedRoute requireAdmin><TravelSmartItineraryPage /></ProtectedRoute>
      </Route>
      <Route path="/travel/smart-itinerary">
        <ProtectedRoute requireAdmin><TravelSmartItineraryPage /></ProtectedRoute>
      </Route>
      <Route path="/travel/ai-itinerary">
        <ProtectedRoute requireAdmin><TravelSmartItineraryPage /></ProtectedRoute>
      </Route>
      <Route path="/backup-restore">
        <ProtectedRoute requireAdmin><BackupRestorePage /></ProtectedRoute>
      </Route>
      <Route path="/backup">
        <ProtectedRoute requireAdmin><BackupRestorePage /></ProtectedRoute>
      </Route>
      <Route path="/system-backup">
        <ProtectedRoute requireAdmin><BackupRestorePage /></ProtectedRoute>
      </Route>
      <Route path="/reports/cashier-statement">
        <ProtectedRoute requireAdmin><CashierStatement /></ProtectedRoute>
      </Route>
      <Route path="/pos">
        <ProtectedRoute><Pos /></ProtectedRoute>
      </Route>
      <Route path="/dashboard">
        <ProtectedRoute requireAdmin><Dashboard /></ProtectedRoute>
      </Route>
      <Route path="/products">
        <ProtectedRoute requireAdmin><Products /></ProtectedRoute>
      </Route>
      <Route path="/categories">
        <ProtectedRoute requireAdmin><Categories /></ProtectedRoute>
      </Route>
      <Route path="/orders">
        <ProtectedRoute requireAdmin><Orders /></ProtectedRoute>
      </Route>
      <Route path="/sales-invoices">
        <ProtectedRoute requireAdmin><WarehouseSalesInvoices /></ProtectedRoute>
      </Route>
      <Route path="/sales-invoice">
        <ProtectedRoute requireAdmin><WarehouseSalesInvoices /></ProtectedRoute>
      </Route>
      <Route path="/warehouse-sales">
        <ProtectedRoute requireAdmin><WarehouseSalesInvoices /></ProtectedRoute>
      </Route>
      <Route path="/customers">
        <ProtectedRoute requireAdmin><Customers /></ProtectedRoute>
      </Route>
      <Route path="/users">
        <ProtectedRoute requireAdmin><Users /></ProtectedRoute>
      </Route>
      <Route path="/reports">
        <ProtectedRoute requireAdmin><Reports /></ProtectedRoute>
      </Route>
      <Route path="/settings">
        <ProtectedRoute requireAdmin><Settings /></ProtectedRoute>
      </Route>
      <Route path="/print-log">
        <ProtectedRoute requireAdmin><PrintLog /></ProtectedRoute>
      </Route>
      <Route path="/hr">
        <ProtectedRoute requireAdmin><HR /></ProtectedRoute>
      </Route>
      <Route path="/accounting">
        <ProtectedRoute requireAdmin><Accounting /></ProtectedRoute>
      </Route>
      <Route path="/document-print-settings">
        <ProtectedRoute requireAdmin><DocumentPrintSettingsPage /></ProtectedRoute>
      </Route>
      <Route path="/returns">
        <ProtectedRoute requireAdmin><Returns /></ProtectedRoute>
      </Route>
      <Route path="/onyx-erp">
        <ProtectedRoute requireAdmin><OnyxErp /></ProtectedRoute>
      </Route>
      <Route path="/licenses">
        <ProtectedRoute requireDeveloper><Licenses /></ProtectedRoute>
      </Route>
      <Route path="/suppliers">
        <ProtectedRoute requireAdmin><Suppliers /></ProtectedRoute>
      </Route>
      <Route path="/purchases">
        <ProtectedRoute requireAdmin><Suppliers /></ProtectedRoute>
      </Route>
      <Route path="/expenses">
        <ProtectedRoute requireAdmin><Expenses /></ProtectedRoute>
      </Route>
      <Route path="/inventory">
        <ProtectedRoute requireAdmin><Inventory /></ProtectedRoute>
      </Route>
      <Route path="/units">
        <ProtectedRoute requireAdmin><UnitsPage /></ProtectedRoute>
      </Route>
      <Route path="/inventory-units">
        <ProtectedRoute requireAdmin><UnitsPage /></ProtectedRoute>
      </Route>
      <Route path="/item-types">
        <ProtectedRoute requireAdmin><ItemTypesPage /></ProtectedRoute>
      </Route>
      <Route path="/inventory-item-types">
        <ProtectedRoute requireAdmin><ItemTypesPage /></ProtectedRoute>
      </Route>
      <Route path="/item-groups">
        <ProtectedRoute requireAdmin><ItemGroupsPage /></ProtectedRoute>
      </Route>
      <Route path="/inventory-groups">
        <ProtectedRoute requireAdmin><ItemGroupsPage /></ProtectedRoute>
      </Route>
      <Route path="/item-classifications">
        <ProtectedRoute requireAdmin><ItemGroupsPage /></ProtectedRoute>
      </Route>
      <Route path="/inventory-types">
        <ProtectedRoute requireAdmin><InventoryTransactionTypesPage /></ProtectedRoute>
      </Route>
      <Route path="/transaction-types">
        <ProtectedRoute requireAdmin><InventoryTransactionTypesPage /></ProtectedRoute>
      </Route>
      <Route path="/inventory-transaction-types">
        <ProtectedRoute requireAdmin><InventoryTransactionTypesPage /></ProtectedRoute>
      </Route>
      <Route path="/inventory-variables">
        <ProtectedRoute requireAdmin><InventoryVariablesPage /></ProtectedRoute>
      </Route>
      <Route path="/warehouse-variables">
        <ProtectedRoute requireAdmin><InventoryVariablesPage /></ProtectedRoute>
      </Route>
      <Route path="/warehouse-operations">
        <ProtectedRoute requireAdmin><WarehouseOperationsPage /></ProtectedRoute>
      </Route>
      <Route path="/warehouse-transfers">
        <ProtectedRoute requireAdmin><WarehouseOperationsPage /></ProtectedRoute>
      </Route>
      <Route path="/warehouse-adjustments">
        <ProtectedRoute requireAdmin><WarehouseOperationsPage /></ProtectedRoute>
      </Route>
      <Route path="/warehouse-archiving">
        <ProtectedRoute requireAdmin><WarehouseOperationsPage /></ProtectedRoute>
      </Route>
      <Route path="/inventory-settings">
        <ProtectedRoute requireAdmin><InventoryVariablesPage /></ProtectedRoute>
      </Route>
      <Route path="/branches">
        <ProtectedRoute requireAdmin><Branches /></ProtectedRoute>
      </Route>
      <Route path="/tables">
        <ProtectedRoute requireAdmin><Tables /></ProtectedRoute>
      </Route>
      <Route path="/shifts">
        <ProtectedRoute requireAdmin><Shifts /></ProtectedRoute>
      </Route>
      <Route path="/currencies">
        <ProtectedRoute requireAdmin><Currencies /></ProtectedRoute>
      </Route>
      <Route path="/audit">
        <ProtectedRoute requireAdmin><Audit /></ProtectedRoute>
      </Route>
      <Route path="/system-guide">
        <ProtectedRoute><SystemGuidePage /></ProtectedRoute>
      </Route>
      <Route path="/brochures">
        <ProtectedRoute><BrochuresPage /></ProtectedRoute>
      </Route>
      <Route path="/">
        <ProtectedRoute><HomeRedirect /></ProtectedRoute>
      </Route>
      <Route component={NotFound} />
    </Switch>
  );
}

import { LicenseExpiryBanner } from "@/components/LicenseExpiryBanner";

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <WouterRouter base={((import.meta as any).env?.BASE_URL || "").replace(/\/$/, "")}>
          <AuthProvider>
            <LicenseExpiryBanner />
            <Router />
          </AuthProvider>
        </WouterRouter>
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
