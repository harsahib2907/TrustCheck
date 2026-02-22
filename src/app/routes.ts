import { createBrowserRouter } from "react-router";
import { ScanPage } from "./pages/ScanPage";
import { PassportPage } from "./pages/PassportPage";
import { NotFoundProduct } from "./pages/NotFoundProduct";
import { LoginPage } from "./pages/LoginPage";
import { ManufacturerDashboard } from "./pages/ManufacturerDashboard";
import { BatchCreationForm } from "./pages/BatchCreationForm";
import { DistributorDashboard } from "./pages/DistributorDashboard";
import { RetailerDashboard } from "./pages/RetailerDashboard";
import { SupplierDashboard } from "./pages/SupplierDashboard";

export const router = createBrowserRouter([
  {
    path: "/",
    Component: ScanPage,
  },
  {
    path: "/passport/:id",
    Component: PassportPage,
  },
  {
    path: "/product-not-found",
    Component: NotFoundProduct,
  },
  {
    path: "/login",
    Component: LoginPage,
  },
  {
    path: "/dashboard/manufacturer",
    Component: ManufacturerDashboard,
  },
  {
    path: "/dashboard/manufacturer/batch/new",
    Component: BatchCreationForm,
  },
  {
    path: "/dashboard/distributor",
    Component: DistributorDashboard,
  },
  {
    path: "/dashboard/retailer",
    Component: RetailerDashboard,
  },
  {
    path: "/dashboard/supplier",
    Component: SupplierDashboard,
  },
  {
    path: "*",
    Component: NotFoundProduct,
  },
]);
