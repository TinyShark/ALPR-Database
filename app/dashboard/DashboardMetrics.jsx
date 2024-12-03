"use client";

import { useState, useEffect } from "react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  ResponsiveContainer,
  LabelList,
} from "recharts";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from "@/components/ui/chart";
import { getDashboardMetrics } from "@/app/actions";
import {
  AlertTriangle,
  TrendingUp,
  Car,
  Eye,
  Calendar,
  Clock,
  Database,
} from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import DashboardLayout from "@/components/layout/MainLayout";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { withBasePath } from "@/lib/utils";

const formatTimeRange = (hour) => {
  const formatHour = (h) => {
    const period = h >= 12 ? "PM" : "AM";
    const adjustedHour = h % 12 || 12;
    return `${adjustedHour}${period}`;
  };
  return formatHour(hour);
};

const formatTimestamp = (timestamp) => {
  if (!timestamp) return "N/A";

  try {
    return new Date(timestamp).toLocaleString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
    });
  } catch (error) {
    console.error("Error formatting timestamp:", error);
    return "Invalid Date";
  }
};

export default function DashboardMetrics() {
  const [metrics, setMetrics] = useState({
    time_distribution: [],
    total_plates_count: 0,
    total_reads: 0,
    unique_plates: 0,
    weekly_unique: 0,
    suspicious_count: 0,
    top_plates: [],
  });
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    async function fetchMetrics() {
      try {
        const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;
        const endDate = new Date();
        const startDate = new Date();
        startDate.setDate(endDate.getDate() - 7);
        const data = await getDashboardMetrics(timeZone, startDate, endDate);
        // Ensure time_distribution is an array before processing
        const sanitizedData = {
          ...data,
          time_distribution: Array.isArray(data?.time_distribution)
            ? data.time_distribution
            : [],
          top_plates: Array.isArray(data?.top_plates) ? data.top_plates : [],
          // Convert string values to numbers
          total_plates_count: parseInt(data?.total_plates_count) || 0,
          total_reads: parseInt(data?.total_reads) || 0,
          unique_plates: parseInt(data?.unique_plates) || 0,
          weekly_unique: parseInt(data?.weekly_unique) || 0,
          suspicious_count: parseInt(data?.suspicious_count) || 0,
        };
        setMetrics(sanitizedData);
      } catch (error) {
        console.error("Error fetching metrics:", error);
        // Set default state on error
        setMetrics({
          time_distribution: [],
          total_plates_count: 0,
          total_reads: 0,
          unique_plates: 0,
          weekly_unique: 0,
          suspicious_count: 0,
          top_plates: [],
        });
      } finally {
        setLoading(false);
      }
    }
    fetchMetrics();
  }, []);

  //Transform time distribution data
  const timeDistributionData = metrics.time_distribution
    .filter((item) => item && typeof item.hour_block === "number")
    .map((item) => ({
      timeRange: formatTimeRange(item.hour_block),
      frequency: parseInt(item.frequency) || 0,
      hour: item.hour_block, // Keep original hour for sorting
    }))
    .sort((a, b) => a.hour - b.hour);

  const mostActiveTime =
    timeDistributionData.length > 0
      ? timeDistributionData.reduce((max, current) =>
          current.frequency > max.frequency ? current : max
        ).timeRange
      : "No data available";

  return (
    <div className="space-y-8">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4">
        <MetricCard
          title="Total Unique Plates"
          value={metrics.total_plates_count}
          icon={<Database className="h-4 w-4" />}
          description="Total unique plates stored in the database"
          loading={loading}
        />
        <MetricCard
          title="Total Reads (24h)"
          value={metrics.total_reads}
          icon={<Eye className="h-4 w-4" />}
          description="License plates scanned in the last 24 hours"
          loading={loading}
        />
        <MetricCard
          title="Unique Plates (24h)"
          value={metrics.unique_plates}
          icon={<Car className="h-4 w-4" />}
          description="Distinct vehicles detected in the last 24 hours"
          loading={loading}
        />
        <MetricCard
          title="Weekly Unique"
          value={metrics.weekly_unique}
          icon={<Calendar className="h-4 w-4" />}
          description="Unique plates seen in the last 7 days"
          loading={loading}
        />
        <MetricCard
          title="Suspicious Plates"
          value={metrics.suspicious_count}
          icon={<AlertTriangle className="h-4 w-4" />}
          description="Total plates tagged as suspicious"
          loading={loading}
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card className="">
          <CardHeader>
            <CardTitle>Time Distribution</CardTitle>
            <CardDescription>
              Frequency of plate sightings by time of day (last 7 days)
            </CardDescription>
          </CardHeader>
          <CardContent className="h-[400px]">
            {loading ? (
              <Skeleton className="w-full h-full" />
            ) : (
              <ChartContainer
                config={{
                  frequency: {
                    label: "Frequency",
                    color: "hsl(var(--chart-1))",
                  },
                }}
                className="w-full h-full"
              >
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={metrics.time_distribution.map((item) => ({
                      timeRange: formatTimeRange(item.hour_block),
                      frequency: Math.round(parseFloat(item.frequency)) || 0,
                      fullLabel: `${formatTimeRange(
                        item.hour_block
                      )} - ${Math.round(parseFloat(item.frequency))} reads`,
                    }))}
                    margin={{
                      top: 20,
                      right: 30,
                      left: 20,
                      bottom: 50,
                    }}
                  >
                    <CartesianGrid vertical={false} />
                    <XAxis
                      dataKey="timeRange"
                      tickLine={false}
                      tickMargin={10}
                      axisLine={false}
                      angle={-45}
                      textAnchor="end"
                      height={80}
                      interval="preserveStartEnd"
                      tick={(props) => {
                        const { x, y, payload } = props;
                        return (
                          <g transform={`translate(${x},${y})`}>
                            <text
                              x={0}
                              y={0}
                              dy={16}
                              textAnchor="end"
                              fill="currentColor"
                              transform="rotate(-45)"
                              className="text-xs md:text-sm"
                            >
                              {payload.value}
                            </text>
                          </g>
                        );
                      }}
                    />
                    <YAxis
                      tickLine={false}
                      axisLine={false}
                      tickFormatter={(value) => Math.round(value)}
                    />
                    <ChartTooltip
                      cursor={{ fill: "rgba(0, 0, 0, 0.1)" }}
                      content={({ active, payload }) => {
                        if (active && payload && payload.length) {
                          return (
                            <div className="rounded-lg border bg-background p-2 shadow-sm">
                              <div className="grid grid-cols-2 gap-2">
                                <div className="flex flex-col">
                                  <span className="text-[0.70rem] uppercase text-muted-foreground">
                                    Time
                                  </span>
                                  <span className="font-bold">
                                    {payload[0].payload.timeRange}
                                  </span>
                                </div>
                                <div className="flex flex-col">
                                  <span className="text-[0.70rem] uppercase text-muted-foreground">
                                    Reads
                                  </span>
                                  <span className="font-bold">
                                    {payload[0].payload.frequency}
                                  </span>
                                </div>
                              </div>
                            </div>
                          );
                        }
                        return null;
                      }}
                    />
                    <Bar
                      dataKey="frequency"
                      fill="var(--color-frequency)"
                      radius={4}
                    >
                      <LabelList
                        dataKey="frequency"
                        position="top"
                        className="fill-foreground text-[10px] md:text-xs"
                        formatter={(value) => Math.round(value)}
                      />
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </ChartContainer>
            )}
          </CardContent>
          <CardFooter className="flex-col items-start gap-2 text-sm">
            <div className="flex gap-2 font-medium leading-none">
              Most active time: {mostActiveTime}
              <TrendingUp className="h-4 w-4" />
            </div>
            <div className="leading-none text-muted-foreground">
              Total plate reads by hour over the last 7 days
            </div>
          </CardFooter>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Top 5 Plates (24h)</CardTitle>
            <CardDescription>
              Most frequently seen license plates in the last 24 hours
            </CardDescription>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="space-y-2">
                {[...Array(5)].map((_, i) => (
                  <Skeleton key={i} className="w-full h-8" />
                ))}
              </div>
            ) : (
              <ul className="space-y-4">
                {metrics.top_plates.map((plate, index) => (
                  <li
                    key={plate.plate}
                    className="flex items-center justify-between px-4 py-2 rounded-lg dark:bg-zinc-900"
                  >
                    <div className="flex items-center gap-4">
                      <span className="text-2xl font-bold text-primary">
                        {index + 1}
                      </span>
                      <div>
                        <p className="font-semibold">{plate.plate}</p>
                        {/* <p className="text-sm text-muted-foreground">
                            Last seen: {formatTimestamp(plate.lastSeen)}
                          </p> */}
                      </div>
                    </div>
                    <Link
                      href={withBasePath("/live_feed")}
                      query={{ search: plate.plate }}
                    >
                      <Badge variant="secondary">{plate.count} reads</Badge>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function MetricCard({ title, value, icon, description, loading }) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium">{title}</CardTitle>
        {icon}
      </CardHeader>
      <CardContent>
        {loading ? (
          <Skeleton className="h-7 w-20" />
        ) : (
          <div className="text-2xl font-bold">{value.toLocaleString()}</div>
        )}
        <p className="text-xs text-muted-foreground mt-1">{description}</p>
      </CardContent>
    </Card>
  );
}
