import React from "react";
import ReactDOM from "react-dom/client";
import { RouterProvider } from "react-router-dom";
import { MotionConfig } from "framer-motion";
import { router } from "./router";
import { TooltipProvider } from "@/web/components/ui/tooltip";
import { DiceOverlay } from "@/web/features/dice/DiceOverlay";
import "./styles.css";

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <MotionConfig reducedMotion="user">
      <TooltipProvider delayDuration={250}>
        <RouterProvider router={router} />
        <DiceOverlay />
      </TooltipProvider>
    </MotionConfig>
  </React.StrictMode>,
);
