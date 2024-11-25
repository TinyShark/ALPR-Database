import { Radio, AlertCircle } from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

export default function BasicTitle({ title, recording, error, children }) {
  return (
    <div className="flex min-h-screen flex-col py-4 px-6">
      <header className="border-b backdrop-blur">
        <div className="container flex h-14 items-center">
          <div className="flex items-center space-x-2">
            <h1 className="text-2xl font-semibold">
              <span className="flex items-center gap-2">
                {title}
                {error ? (
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger>
                        <AlertCircle className="text-yellow-500" />
                      </TooltipTrigger>
                      <TooltipContent>
                        <p>{error}</p>
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                ) : (
                  recording && <Radio className="text-red-500 animate-pulse" />
                )}
              </span>
            </h1>
          </div>
        </div>
      </header>
      <div className="flex-1">
        <div className="py-6">{children}</div>
      </div>
    </div>
  );
}
