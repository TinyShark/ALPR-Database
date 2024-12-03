"use client";

import { useState } from "react";
import { useTransition, useOptimistic } from "react";
import { Eye, EyeOff, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import DashboardLayout from "@/components/layout/MainLayout";
import {
  updateSettings,
  updatePassword,
  regenerateApiKey,
} from "@/app/actions";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";

const navigation = [
  { title: "General", id: "general" },
  { title: "MQTT/HTTP", id: "mqtt" },
  { title: "Database", id: "database" },
  { title: "Push Notifications", id: "push" },
  { title: "HomeAssistant", id: "homeassistant" },
  { title: "Security", id: "security" },
];

export default function SettingsForm({ initialSettings, initialApiKey }) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);
  const [activeSection, setActiveSection] = useState("general");
  const [showApiKey, setShowApiKey] = useState(false);
  const [showDialog, setShowDialog] = useState(false);

  const handleSettingsSubmit = async (formData) => {
    setError("");
    setSuccess(false);

    const newFormData = new FormData();

    switch (activeSection) {
      case "general":
        newFormData.append("maxRecords", formData.get("maxRecords"));
        newFormData.append("ignoreNonPlate", formData.get("ignoreNonPlate"));
        break;
      case "mqtt":
        newFormData.append("mqttBroker", formData.get("mqttBroker"));
        newFormData.append("mqttTopic", formData.get("mqttTopic"));
        break;
      case "database":
        newFormData.append("dbHost", formData.get("dbHost"));
        newFormData.append("dbName", formData.get("dbName"));
        newFormData.append("dbUser", formData.get("dbUser"));
        newFormData.append("dbPassword", formData.get("dbPassword"));
        break;
      case "push":
        newFormData.append(
          "pushoverEnabled",
          formData.get("pushoverEnabled") === "on"
        );
        newFormData.append(
          "pushoverAppToken",
          formData.get("pushoverAppToken")
        );
        newFormData.append("pushoverUserKey", formData.get("pushoverUserKey"));
        newFormData.append("pushoverTitle", formData.get("pushoverTitle"));
        newFormData.append(
          "pushoverPriority",
          formData.get("pushoverPriority")
        );
        newFormData.append("pushoverSound", formData.get("pushoverSound"));
        break;
      case "homeassistant":
        newFormData.append("haEnabled", formData.get("haEnabled") === "on");
        newFormData.append("haBasePath", formData.get("haBasePath"));
        if (formData.get("haWhitelist")) {
          newFormData.append("haWhitelist", formData.get("haWhitelist"));
        }
        break;
    }

    startTransition(async () => {
      const result = await updateSettings(newFormData);
      if (result.success) {
        setSuccess(true);
        setTimeout(() => setSuccess(false), 3000);
      } else {
        setError(result.error);
      }
    });
  };

  const handlePasswordSubmit = async (event) => {
    event.preventDefault();
    setError("");

    const formData = new FormData(event.target);

    if (formData.get("newPassword") !== formData.get("confirmPassword")) {
      setError("Passwords do not match");
      return;
    }

    startTransition(async () => {
      const result = await updatePassword(formData.get("newPassword"));
      if (result.success) {
        setSuccess(true);
        event.target.reset();
      } else {
        setError(result.error);
      }
    });
  };

  const handleRegenerateApiKey = async () => {
    setError("");
    startTransition(async () => {
      const result = await regenerateApiKey();
      if (result.success) {
        setShowDialog(false);
        setSuccess(true);
      } else {
        setError(result.error);
      }
    });
  };

  const renderGeneralSection = () => (
    // Add key to force re-render when section changes
    <div key="general-section" className="space-y-4">
      <h3 className="text-lg font-semibold">General Settings</h3>
      <div className="space-y-2">
        <Label htmlFor="maxRecords">Maximum number of records to keep</Label>
        <Input
          id="maxRecords"
          name="maxRecords"
          type="number"
          defaultValue={initialSettings.general.maxRecords}
          autoComplete="off"
        />
      </div>
      <div className="flex items-center space-x-2">
        <Checkbox
          id="ignoreNonPlate"
          name="ignoreNonPlate"
          defaultChecked={initialSettings.general.ignoreNonPlate}
        />
        <Label htmlFor="ignoreNonPlate">
          Ignore non-plate number OCR reads
        </Label>
      </div>
    </div>
  );

  const renderMqttSection = () => (
    <div key="mqtt-section" className="space-y-4">
      <h3 className="text-lg font-semibold">MQTT Configuration</h3>
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="mqttBroker">MQTT Broker URL/IP</Label>
          <Input
            id="mqttBroker"
            name="mqttBroker"
            defaultValue={initialSettings.mqtt.broker}
            placeholder="mqtt://example.com"
            autoComplete="off"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="mqttTopic">MQTT Topic</Label>
          <Input
            id="mqttTopic"
            name="mqttTopic"
            defaultValue={initialSettings.mqtt.topic}
            placeholder="alpr/plates"
            autoComplete="off"
          />
        </div>
      </div>
    </div>
  );

  const renderDatabaseSection = () => (
    <div key="database-section" className="space-y-4">
      <h3 className="text-lg font-semibold">Database Configuration</h3>
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="dbHost">Database Host & Port</Label>
          <Input
            id="dbHost"
            name="dbHost"
            defaultValue={initialSettings.database.host}
            placeholder="localhost:5432"
            autoComplete="off"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="dbName">Database Name</Label>
          <Input
            id="dbName"
            name="dbName"
            defaultValue={initialSettings.database.name}
            placeholder="alpr_db"
            autoComplete="off"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="dbUser">Database User</Label>
          <Input
            id="dbUser"
            name="dbUser"
            defaultValue={initialSettings.database.user}
            placeholder="username"
            autoComplete="off"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="dbPassword">Database Password</Label>
          <Input
            id="dbPassword"
            name="dbPassword"
            type="password"
            defaultValue={initialSettings.database.password}
            placeholder="••••••••"
            autoComplete="new-password"
          />
        </div>
      </div>
    </div>
  );

  const renderPushSection = () => (
    <div key="push-section" className="space-y-4">
      <h3 className="text-lg font-semibold">Pushover Configuration</h3>
      <div className="space-y-4">
        <div className="flex items-center justify-between py-2">
          <div className="space-y-0.5">
            <Label htmlFor="pushoverEnabled">Enable Pushover</Label>
            <p className="text-sm text-muted-foreground">
              Receive notifications when plates are detected
            </p>
          </div>
          <Switch
            id="pushoverEnabled"
            name="pushoverEnabled"
            defaultChecked={initialSettings.notifications?.pushover?.enabled}
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="pushoverAppToken">
              Application Token (APP_TOKEN)
            </Label>
            <Input
              id="pushoverAppToken"
              name="pushoverAppToken"
              type="token"
              defaultValue={initialSettings.notifications?.pushover?.app_token}
              placeholder="Your Pushover application token"
              autoComplete="off"
              autoCorrect="off"
              autoCapitalize="off"
              spellCheck="false"
              data-form-type="other"
              // Use a random name attribute to further prevent autofill
              {...{ "data-lpignore": "true" }}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="pushoverUserKey">User Key (USER_KEY)</Label>
            <Input
              id="pushoverUserKey"
              name="pushoverUserKey"
              type="token"
              defaultValue={initialSettings.notifications?.pushover?.user_key}
              placeholder="Your Pushover user key"
              autoComplete="off"
              autoCorrect="off"
              autoCapitalize="off"
              spellCheck="false"
              data-form-type="other"
              {...{ "data-lpignore": "true" }}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="pushoverTitle">Notification Title</Label>
            <Input
              id="pushoverTitle"
              name="pushoverTitle"
              defaultValue={initialSettings.notifications?.pushover?.title}
              placeholder="ALPR Alert"
              autoComplete="off"
              autoCorrect="off"
              autoCapitalize="off"
              spellCheck="false"
              data-form-type="other"
              {...{ "data-lpignore": "true" }}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="pushoverPriority">Priority (-2 to 2)</Label>
            <Input
              id="pushoverPriority"
              name="pushoverPriority"
              type="number"
              min="-2"
              max="2"
              defaultValue={initialSettings.notifications?.pushover?.priority}
              autoComplete="off"
              {...{ "data-lpignore": "true" }}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="pushoverSound">Notification Sound</Label>
            <Input
              id="pushoverSound"
              name="pushoverSound"
              defaultValue={initialSettings.notifications?.pushover?.sound}
              placeholder="pushover"
              autoComplete="off"
              autoCorrect="off"
              autoCapitalize="off"
              spellCheck="false"
              data-form-type="other"
              {...{ "data-lpignore": "true" }}
            />
          </div>
        </div>
      </div>
    </div>
  );

  const renderHomeAssistantSection = () => (
    <div key="homeassistant-section" className="space-y-4">
      <h3 className="text-lg font-semibold">Home Assistant Integration</h3>
      <div className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="haBasePath">Base Path</Label>
          <Input
            id="haBasePath"
            name="haBasePath"
            type="text"
            defaultValue={initialSettings.homeassistant?.basePath}
            placeholder="/alpr"
            autoComplete="off"
          />
          <p className="text-sm text-muted-foreground">
            Set the base path for Home Assistant ingress integration (e.g., /alpr). Leave empty for standalone use.
          </p>
        </div>

        <div className="flex items-center justify-between py-2">
          <div className="space-y-0.5">
            <Label htmlFor="haEnabled" className="font-semibold">
              Enable Whitelist
            </Label>
            <p className="text-sm text-muted-foreground">
              Allow specific devices to bypass authentication when accessing the
              app via HomeAssistant iframe.
            </p>
          </div>
          <Switch
            id="haEnabled"
            name="haEnabled"
            defaultChecked={initialSettings.homeassistant?.enabled}
          />
        </div>

        {initialSettings.homeassistant?.enabled && (
          <IPWhitelistManager
            initialIPs={initialSettings.homeassistant?.whitelist || []}
            onUpdate={(newIPs) => {
              const formData = new FormData();
              formData.append("haWhitelist", JSON.stringify(newIPs));
              handleSettingsSubmit(formData);
            }}
          />
        )}
      </div>
    </div>
  );

  const renderSecuritySection = () => (
    <div className="space-y-8">
      <div className="space-y-4">
        <h3 className="text-lg font-semibold">Change Password</h3>
        <form onSubmit={handlePasswordSubmit} className="space-y-4">
          <div>
            <Label htmlFor="currentPassword">Current Password</Label>
            <Input
              id="currentPassword"
              name="currentPassword"
              type="password"
              required
              autoComplete="current-password"
            />
          </div>
          <div>
            <Label htmlFor="newPassword">New Password</Label>
            <Input
              id="newPassword"
              name="newPassword"
              type="password"
              required
              autoComplete="new-password"
            />
          </div>
          <div>
            <Label htmlFor="confirmPassword">Confirm New Password</Label>
            <Input
              id="confirmPassword"
              name="confirmPassword"
              type="password"
              required
              autoComplete="new-password"
            />
          </div>
          <Button type="submit" disabled={isPending}>
            {isPending ? "Changing..." : "Change Password"}
          </Button>
        </form>
      </div>

      <div className="space-y-4">
        <h3 className="text-lg font-semibold">API Key Management</h3>
        <div>
          <Label>Current API Key</Label>
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Input
                readOnly
                value={initialApiKey}
                type={showApiKey ? "text" : "password"}
                autoComplete="off"
              />
            </div>
            <Button
              variant="outline"
              onClick={() => setShowApiKey(!showApiKey)}
              size="icon"
            >
              {showApiKey ? (
                <EyeOff className="h-4 w-4" />
              ) : (
                <Eye className="h-4 w-4" />
              )}
            </Button>
          </div>
        </div>

        <Dialog open={showDialog} onOpenChange={setShowDialog}>
          <DialogTrigger asChild>
            <Button variant="destructive">Regenerate API Key</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Regenerate API Key</DialogTitle>
              <DialogDescription>
                Are you sure you want to regenerate the API key? This will
                invalidate the current key and any systems using it will need to
                be updated.
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowDialog(false)}>
                Cancel
              </Button>
              <Button variant="destructive" onClick={handleRegenerateApiKey}>
                Regenerate
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );

  const renderSection = () => (
    <div key={activeSection}>
      {(() => {
        switch (activeSection) {
          case "general":
            return renderGeneralSection();
          case "mqtt":
            return renderMqttSection();
          case "database":
            return renderDatabaseSection();
          case "push":
            return renderPushSection();
          case "homeassistant":
            return renderHomeAssistantSection();
          case "security":
            return renderSecuritySection();
          default:
            return null;
        }
      })()}
    </div>
  );

  return (
    <DashboardLayout>
      <div className="flex min-h-screen flex-col py-4 px-6">
        <header className="border-b backdrop-blur">
          <div className="container flex h-14 items-center">
            <div className="flex items-center space-x-2">
              <h1 className="text-2xl font-medium">System Settings</h1>
            </div>
          </div>
          <nav className="container">
            <div className="flex space-x-6">
              {navigation.map((item) => (
                <div key={item.id} className="relative">
                  <a
                    onClick={() => setActiveSection(item.id)}
                    className={`flex h-14 items-center text-sm font-medium transition-colors hover:text-primary cursor-pointer ${
                      item.id === activeSection
                        ? "text-primary"
                        : "text-muted-foreground"
                    }`}
                  >
                    {item.title}
                  </a>
                  {item.id === activeSection && (
                    <div
                      className="absolute bottom-0 left-0 h-0.5 bg-primary transition-all duration-300 ease-in-out"
                      style={{ width: "100%" }}
                    />
                  )}
                </div>
              ))}
            </div>
          </nav>
        </header>

        <div className="flex-1">
          <div className="py-6">
            {error && (
              <div className="mb-4 p-4 text-red-600 bg-red-50 rounded-md">
                {error}
              </div>
            )}
            {success && (
              <div className="mb-4 p-4 text-green-600 bg-green-50 rounded-md">
                Settings updated successfully!
              </div>
            )}

            {activeSection !== "security" ? (
              <form action={handleSettingsSubmit}>
                <Card className="w-full max-w-4xl">
                  <CardHeader>
                    {/* <CardTitle>ALPR Database Settings</CardTitle>
                    <CardDescription>
                      Configure your ALPR database application settings
                    </CardDescription> */}
                  </CardHeader>
                  <CardContent>{renderSection()}</CardContent>
                  <CardFooter>
                    <Button type="submit" disabled={isPending}>
                      {isPending ? "Saving..." : "Save Settings"}
                    </Button>
                  </CardFooter>
                </Card>
              </form>
            ) : (
              <Card className="w-full max-w-4xl">
                <CardHeader>
                  <CardTitle>Security Settings</CardTitle>
                  <CardDescription>
                    Manage your security settings and API keys
                  </CardDescription>
                </CardHeader>
                <CardContent>{renderSection()}</CardContent>
              </Card>
            )}
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}

const IPWhitelistManager = ({ initialIPs = [], onUpdate }) => {
  const [newIP, setNewIP] = useState("");
  const [error, setError] = useState("");

  const isValidIP = (ip) => {
    // Basic IP validation (IPv4 and IPv6)
    const ipv4Regex = /^(\d{1,3}\.){3}\d{1,3}$/;
    const ipv6Regex =
      /^([0-9a-fA-F]{1,4}:){7}[0-9a-fA-F]{1,4}$|^(([0-9a-fA-F]{1,4}:){0,6}[0-9a-fA-F]{1,4})?::([0-9a-fA-F]{1,4}:){0,6}[0-9a-fA-F]{1,4}$/;

    return ipv4Regex.test(ip) || ipv6Regex.test(ip);
  };

  const handleAddIP = () => {
    setError("");
    if (!newIP) {
      setError("Please enter an IP address");
      return;
    }

    if (!isValidIP(newIP)) {
      setError("Please enter a valid IP address");
      return;
    }

    if (initialIPs.includes(newIP)) {
      setError("This IP is already in the whitelist");
      return;
    }

    onUpdate([...initialIPs, newIP]);
    setNewIP("");
  };

  const handleRemoveIP = (ipToRemove) => {
    onUpdate(initialIPs.filter((ip) => ip !== ipToRemove));
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-col space-y-2">
        <Label htmlFor="ipInput">IP Address Whitelist</Label>
        <div className="flex space-x-2">
          <Input
            id="ipInput"
            value={newIP}
            onChange={(e) => setNewIP(e.target.value)}
            placeholder="Enter IP address"
            className="flex-1"
          />
          <Button onClick={handleAddIP}>Add IP</Button>
        </div>
        {error && <p className="text-sm text-destructive">{error}</p>}
      </div>

      <div className="flex flex-wrap gap-2">
        {initialIPs.map((ip) => (
          <Badge
            key={ip}
            variant="secondary"
            className="flex items-center gap-1"
          >
            {ip}
            <Button
              variant="ghost"
              size="sm"
              className="h-4 w-4 p-0 hover:bg-transparent"
              onClick={() => handleRemoveIP(ip)}
            >
              <X className="h-3 w-3" />
            </Button>
          </Badge>
        ))}
      </div>
    </div>
  );
};
