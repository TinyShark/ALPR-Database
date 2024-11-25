"use client";

import { useState } from "react";
import { PlateTableWrapper } from "@/components/PlateTableWrapper";
import DashboardLayout from "@/components/layout/MainLayout";
import BasicTitle from "@/components/layout/BasicTitle";

export default function LivePlates() {
  const [isRecording, setIsRecording] = useState(false);
  const [connectionError, setConnectionError] = useState(null);

  return (
    <DashboardLayout>
      <BasicTitle 
        title="Live ALPR Feed" 
        recording={isRecording}
        error={connectionError}
      >
        <PlateTableWrapper 
          onConnectionChange={setIsRecording} 
          onConnectionError={setConnectionError}
        />
      </BasicTitle>
    </DashboardLayout>
  );
}
