"use client";

import { Toaster as SonnerToaster } from "sonner";

export function Toaster() {
  return (
    <SonnerToaster
      position="top-right"
      duration={2600}
      visibleToasts={3}
      closeButton
      richColors
    />
  );
}
