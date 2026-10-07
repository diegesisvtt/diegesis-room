import React from "react";
import ReactDOM from "react-dom/client";
import { RouterProvider } from "react-router-dom";
import { router } from "./router";
import { TooltipProvider } from "@/web/components/ui/tooltip";
import "./styles.css";

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <TooltipProvider delayDuration={250}>
      <RouterProvider router={router} />
    </TooltipProvider>
  </React.StrictMode>,
);
