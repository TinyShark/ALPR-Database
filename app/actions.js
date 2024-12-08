"use server";

//This is extremely sloppy. Should really clean up the actions.

import {
  getAvailableTags,
  createTag,
  updateTagColor,
  deleteTag,
  updateKnownPlate,
  removeKnownPlate,
  addTagToPlate,
  removeTagFromPlate,
  getPlateHistory,
  getPlateReads,
  getAllPlates,
  getPlateInsights,
  getKnownPlates,
  togglePlateFlag,
  getMetrics,
  getFlaggedPlates,
  removePlate,
  removePlateRead,
  getPool,
  resetPool,
  updateNotificationPriorityDB,
  getTagsForPlate,
  correctAllPlateReads,
  getDistinctCameraNames,
  updatePlateRead,
  updateAllPlateReads,
  removeMisread,
} from "@/lib/db";
import {
  getNotificationPlates as getNotificationPlatesDB,
  addNotificationPlate as addNotificationPlateDB,
  toggleNotification as toggleNotificationDB,
  deleteNotification as deleteNotificationDB,
  addKnownPlateWithMisreads as addKnownPlateWithMisreadsDB,
  getAllPlatesWithKnownInfo as getAllPlatesWithKnownInfoDB,
} from "@/lib/db";

import { revalidatePath } from "next/cache";
import fs from "fs/promises";
import yaml from "js-yaml";
import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import crypto from "crypto";
import { getConfig, saveConfig } from "@/lib/settings";
import {
  getAuthConfig,
  updateAuthConfig,
  hashPassword,
  createSession,
} from "@/lib/auth";
import * as db from "@/lib/db";

export async function handleGetTags() {
  return await dbGetTags();
}

export async function handleCreateTag(tagName, color) {
  return await dbCreateTag(tagName, color);
}

export async function handleDeleteTag(tagName) {
  return await dbDeleteTag(tagName);
}

export async function getDashboardMetrics(timeZone, startDate, endDate) {
  try {
    const metrics = await getMetrics(startDate, endDate);

    // Create an array with all 24 hour blocks
    const allHourBlocks = Array.from({ length: 24 }, (_, i) => i);

    // Format the time distribution data in the specified timezone
    const timeDistribution = allHourBlocks.map((hourBlock) => {
      const matchingReads = metrics.time_data.filter((read) => {
        const timestamp = new Date(read.timestamp);
        const localTimestamp = new Date(
          timestamp.toLocaleString("en-US", { timeZone })
        );
        const localHour = localTimestamp.getHours();
        return localHour === hourBlock;
      });

      const frequency = matchingReads.reduce(
        (sum, read) => sum + read.frequency,
        0
      );

      return {
        hour_block: hourBlock,
        frequency: frequency,
      };
    });

    return {
      ...metrics,
      time_distribution: timeDistribution,
    };
  } catch (error) {
    console.error("Error fetching dashboard metrics:", error);
    return {
      time_distribution: [],
      total_plates_count: 0,
      total_reads: 0,
      unique_plates: 0,
      weekly_unique: 0,
      suspicious_count: 0,
      top_plates: [],
    };
  }
}

export async function updateTag(formData) {
  try {
    const name = formData.get("name");
    const color = formData.get("color");
    const tag = await updateTagColor(name, color);
    return { success: true, data: tag };
  } catch (error) {
    console.error("Error updating tag:", error);
    return { success: false, error: "Failed to update tag color" };
  }
}

export async function deleteTagFromPlate(formData) {
  try {
    const plateNumber = formData.get("plateNumber");
    const tagName = formData.get("tagName");
    await removeTagFromPlate(plateNumber, tagName);
    return { success: true };
  } catch (error) {
    console.error("Error removing tag from plate:", error);
    return { success: false, error: "Failed to remove tag from plate" };
  }
}

export async function deletePlate(formData) {
  try {
    const plateNumber = formData.get("plateNumber");
    await removeKnownPlate(plateNumber);
    return { success: true };
  } catch (error) {
    console.error("Error removing known plate:", error);
    return { success: false, error: "Failed to remove known plate" };
  }
}

export async function deletePlateFromDB(formData) {
  try {
    const plateNumber = formData.get("plateNumber");
    await removePlate(plateNumber);
    return { success: true };
  } catch (error) {
    console.error("Error removing known plate:", error);
    return { success: false, error: "Failed to remove plate" };
  }
}

export async function deletePlateRead(formData) {
  try {
    const readId = formData.get("readId");
    if (!readId) {
      return { success: false, error: "No read ID provided" };
    }

    const pool = await getPool();
    const result = await pool.query(
      "DELETE FROM plate_reads WHERE id = $1",
      [readId]
    );

    return { success: true };
  } catch (error) {
    console.error("Failed to delete plate read:", error);
    return { success: false, error: error.message };
  }
}

export async function getKnownPlatesList() {
  try {
    return { success: true, data: await getKnownPlates() };
  } catch (error) {
    console.error("Error getting known plates:", error);
    return { success: false, error: "Failed to get known plates" };
  }
}

export async function getTags() {
  try {
    return { success: true, data: await getAvailableTags() };
  } catch (error) {
    console.error("Error getting tags:", error);
    return { success: false, error: "Failed to get tags" };
  }
}

export async function addTag(formData) {
  try {
    const name = formData.get("name");
    const color = formData.get("color") || "#808080";
    const tag = await createTag(name, color);
    return { success: true, data: tag };
  } catch (error) {
    console.error("Error creating tag:", error);
    return { success: false, error: "Failed to create tag" };
  }
}

export async function removeTag(formData) {
  try {
    const name = formData.get("name");
    await deleteTag(name);
    return { success: true };
  } catch (error) {
    console.error("Error deleting tag:", error);
    return { success: false, error: "Failed to delete tag" };
  }
}

export async function addKnownPlate(formData) {
  try {
    const plateNumber = formData.get("plateNumber");
    const name = formData.get("name");
    const notes = formData.get("notes") || null;

    const plate = await updateKnownPlate(plateNumber, { name, notes });
    return { success: true, data: plate };
  } catch (error) {
    console.error("Error adding known plate:", error);
    return { success: false, error: "Failed to add known plate" };
  }
}

export async function tagPlate(formData) {
  try {
    const plateNumber = formData.get("plateNumber");
    const tagName = formData.get("tagName");

    // Check if tag already exists on plate
    const existingTags = await getTagsForPlate(plateNumber);
    if (existingTags.includes(tagName)) {
      return {
        success: false,
        error: `Tag "${tagName}" is already added to this plate`,
      };
    }

    await addTagToPlate(plateNumber, tagName);
    return { success: true };
  } catch (error) {
    console.error("Error adding tag to plate:", error);
    return { success: false, error: "Failed to add tag to plate" };
  }
}

export async function untagPlate(formData) {
  try {
    const plateNumber = formData.get("plateNumber");
    const tagName = formData.get("tagName");
    await removeTagFromPlate(plateNumber, tagName);
    return { success: true };
  } catch (error) {
    console.error("Error removing tag from plate:", error);
    return { success: false, error: "Failed to remove tag from plate" };
  }
}

export async function getPlateHistoryData(plateNumber) {
  try {
    return { success: true, data: await getPlateHistory(plateNumber) };
  } catch (error) {
    console.error("Error getting plate history:", error);
    return { success: false, error: "Failed to get plate history" };
  }
}

export async function getPlates() {
  try {
    return { success: true, data: await getAllPlates() };
  } catch (error) {
    console.error("Error getting plates database:", error);
    return { success: false, error: "Failed to get plates database" };
  }
}

export async function getLatestPlateReads({
  page = 1,
  pageSize = 25,
  search = "",
  fuzzySearch = false,
  tag = "all",
  dateRange = null,
  cameraName = "",
  timeFrom = null,
  timeTo = null
} = {}) {
  try {
    const result = await db.getPlateReads({
      page,
      pageSize,
      filters: {
        plateNumber: search,
        fuzzySearch,
        tag: tag !== "all" ? tag : undefined,
        dateRange,
        cameraName: cameraName || undefined,
        timeFrom,
        timeTo
      },
    });

    return {
      data: result.data,
      pagination: result.pagination,
    };
  } catch (error) {
    console.error("Error fetching plate reads:", error);
    return {
      data: [],
      pagination: {
        page,
        pageSize,
        total: 0,
        pageCount: 0,
      },
    };
  }
}

export async function fetchPlateInsights(formDataOrPlateNumber, timeZone) {
  try {
    let plateNumber;
    if (formDataOrPlateNumber instanceof FormData) {
      plateNumber = formDataOrPlateNumber.get("plateNumber");
    } else {
      plateNumber = formDataOrPlateNumber;
    }

    if (!plateNumber) {
      return { success: false, error: "Plate number is required" };
    }

    const insights = await getPlateInsights(plateNumber);

    // Create an array with all 24 hour blocks
    const allHourBlocks = Array.from({ length: 12 }, (_, i) => i * 2);

    // Format the time distribution data in the specified timezone
    const timeDistribution = allHourBlocks.map((hourBlock) => {
      const timeRange = `${String(hourBlock).padStart(2, "0")}:00-${String(
        (hourBlock + 2) % 24
      ).padStart(2, "0")}:00`;
      const matchingReads = insights.time_data.filter((read) => {
        const timestamp = new Date(read.timestamp);
        const localTimestamp = new Date(
          timestamp.toLocaleString("en-US", { timeZone })
        );
        const readHourBlock = Math.floor(localTimestamp.getHours() / 2) * 2;
        return readHourBlock === hourBlock;
      });

      const frequency = matchingReads.reduce(
        (sum, read) => sum + read.frequency,
        0
      );

      return {
        timeBlock: hourBlock,
        frequency: frequency,
        timeRange: timeRange,
      };
    });

    return {
      success: true,
      data: {
        plateNumber: insights.plate_number,
        knownName: insights.known_name,
        notes: insights.notes,
        summary: {
          firstSeen: insights.first_seen_at,
          lastSeen: insights.last_seen_at,
          totalOccurrences: insights.total_occurrences,
        },
        tags: insights.tags || [],
        timeDistribution: timeDistribution,
        recentReads: insights.recent_reads || [],
      },
    };
  } catch (error) {
    console.error("Failed to get plate insights:", error);
    return { success: false, error: "Failed to get plate insights" };
  }
}

export async function alterPlateFlag(formData) {
  try {
    const plateNumber = formData.get("plateNumber");
    const flagged = formData.get("flagged") === "true";

    const result = await togglePlateFlag(plateNumber, flagged);

    return {
      success: true,
      data: result,
    };
  } catch (error) {
    console.error("Failed to toggle plate flag:", error);
    return {
      success: false,
      error: "Failed to toggle plate flag",
    };
  }
}

export async function getFlagged() {
  try {
    const plates = await getFlaggedPlates();
    return plates;
  } catch (error) {
    console.error("Error fetching flagged plates:", error);
    return [];
  }
}

export async function getNotificationPlates() {
  try {
    const plates = await getNotificationPlatesDB();
    return { success: true, data: plates };
  } catch (error) {
    console.error("Error in getNotificationPlates action:", error);
    return { success: false, error: "Failed to fetch notification plates" };
  }
}

export async function addNotificationPlate(formData) {
  const plateNumber = formData.get("plateNumber");
  return await addNotificationPlateDB(plateNumber);
}

export async function toggleNotification(formData) {
  const plateNumber = formData.get("plateNumber");
  const enabled = formData.get("enabled") === "true";
  return await toggleNotificationDB(plateNumber, enabled);
}

export async function deleteNotification(formData) {
  try {
    const plateNumber = formData.get("plateNumber");
    await deleteNotificationDB(plateNumber);
    return { success: true };
  } catch (error) {
    console.error("Error deleting notification:", error);
    return { success: false, error: "Failed to delete notification" };
  }
}

export async function updateNotificationPriority(formData) {
  try {
    // When using Select component, the values come directly as arguments
    // not as FormData
    const plateNumber = formData.plateNumber;
    const priority = parseInt(formData.priority);

    if (isNaN(priority) || priority < -2 || priority > 2) {
      return { success: false, error: "Invalid priority value" };
    }

    const result = await updateNotificationPriorityDB(plateNumber, priority);
    if (!result) {
      return { success: false, error: "Notification not found" };
    }
    return { success: true, data: result };
  } catch (error) {
    console.error("Error updating notification priority:", error);
    return { success: false, error: "Failed to update notification priority" };
  }
}

export async function loginAction(formData) {
  const password = formData.get("password");
  if (!password) {
    return { error: "Password is required" };
  }

  try {
    const config = await getAuthConfig();

    // Verify password
    if (hashPassword(password) !== config.password) {
      console.log("Invalid password attempt");
      return { error: "Invalid password" };
    }

    // Create new session
    const sessionId = await createSession();
    console.log("Created session ID:", sessionId);

    // Set cookie
    const cookieStore = await cookies();
    cookieStore.set("session", sessionId, {
      httpOnly: true,
      secure: false,
      sameSite: "lax",
      maxAge: 60 * 60 * 24, // 24 hours
    });

    // Verify cookie was set
    const checkCookie = cookieStore.get("session");
    console.log("Cookie after setting:", checkCookie);

    return { success: true };
  } catch (error) {
    console.error("Login error:", error);
    return { error: "An error occurred during login" };
  }
}

export async function getSettings() {
  const config = await getConfig();
  return config;
}

export async function updateSettings(formData) {
  try {
    const currentConfig = await getConfig();

    const newConfig = { ...currentConfig };

    const updateIfExists = (key) => formData.get(key) !== null;

    //isolate sections so we don't erase other stuff
    if (updateIfExists("maxRecords") || updateIfExists("ignoreNonPlate")) {
      newConfig.general = {
        ...currentConfig.general,
        maxRecords: formData.get("maxRecords")
          ? parseInt(formData.get("maxRecords"))
          : currentConfig.general.maxRecords,
        ignoreNonPlate: formData.get("ignoreNonPlate") === "true",
      };
    }

    if (updateIfExists("mqttBroker") || updateIfExists("mqttTopic")) {
      newConfig.mqtt = {
        ...currentConfig.mqtt,
        broker: formData.get("mqttBroker") ?? currentConfig.mqtt.broker,
        topic: formData.get("mqttTopic") ?? currentConfig.mqtt.topic,
      };
    }

    if (
      updateIfExists("dbHost") ||
      updateIfExists("dbName") ||
      updateIfExists("dbUser") ||
      updateIfExists("dbPassword")
    ) {
      newConfig.database = {
        ...currentConfig.database,
        host: formData.get("dbHost") ?? currentConfig.database.host,
        name: formData.get("dbName") ?? currentConfig.database.name,
        user: formData.get("dbUser") ?? currentConfig.database.user,
        password:
          formData.get("dbPassword") === "••••••••"
            ? currentConfig.database.password
            : formData.get("dbPassword") ?? currentConfig.database.password,
      };
    }

    if (updateIfExists("pushoverEnabled")) {
      newConfig.notifications = {
        ...currentConfig.notifications,
        pushover: {
          ...currentConfig.notifications?.pushover,
          enabled: formData.get("pushoverEnabled") === "true",
          app_token:
            formData.get("pushoverAppToken") === "••••••••"
              ? currentConfig.notifications?.pushover?.app_token
              : formData.get("pushoverAppToken") ??
                currentConfig.notifications?.pushover?.app_token,
          user_key:
            formData.get("pushoverUserKey") === "••••••••"
              ? currentConfig.notifications?.pushover?.user_key
              : formData.get("pushoverUserKey") ??
                currentConfig.notifications?.pushover?.user_key,
          title:
            formData.get("pushoverTitle") ??
            currentConfig.notifications?.pushover?.title,
          priority: formData.get("pushoverPriority")
            ? parseInt(formData.get("pushoverPriority"))
            : currentConfig.notifications?.pushover?.priority,
          sound:
            formData.get("pushoverSound") ??
            currentConfig.notifications?.pushover?.sound,
        },
      };
    }

    if (updateIfExists("haEnabled") || updateIfExists("haWhitelist")) {
      newConfig.homeassistant = {
        ...currentConfig.homeassistant,
        enabled: formData.get("haEnabled") === "true",
        whitelist: formData.get("haWhitelist")
          ? JSON.parse(formData.get("haWhitelist"))
          : currentConfig.homeassistant?.whitelist || [],
      };
    }
    const result = await saveConfig(newConfig);
    if (!result.success) {
      return { success: false, error: result.error };
    }

    revalidatePath("/settings");
    return { success: true };
  } catch (error) {
    console.error("Error updating settings:", error);
    return { success: false, error: error.message };
  }
}

export async function updatePassword(newPassword) {
  try {
    const updatedPassword = hashPassword(newPassword);
    const config = await getAuthConfig();
    await updateAuthConfig({
      ...config,
      password: updatedPassword,
    });

    revalidatePath("/settings");
    return { success: true };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

export async function regenerateApiKey() {
  try {
    const config = await getAuthConfig();
    const newApiKey = crypto.randomBytes(32).toString("hex");

    await updateAuthConfig({
      ...config,
      apiKey: newApiKey,
    });

    revalidatePath("/settings");
    return { success: true, apiKey: newApiKey };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

export async function getCameraNames() {
  try {
    const cameraNames = await getDistinctCameraNames();
    return {
      success: true,
      data: cameraNames,
    };
  } catch (error) {
    console.error("Error getting camera names:", error);
    return {
      success: false,
      error: "Failed to fetch camera names",
    };
  }
}

export async function correctPlateRead(formData) {
  try {
    const readId = formData.get("readId");
    const oldPlateNumber = formData.get("oldPlateNumber");
    const newPlateNumber = formData.get("newPlateNumber");
    const correctAll = formData.get("correctAll") === "true";
    const removePrevious = formData.get("removePrevious") === "true";

    if (correctAll) {
      await updateAllPlateReads(oldPlateNumber, newPlateNumber);
    } else {
      await updatePlateRead(readId, newPlateNumber);
    }

    if (removePrevious) {
      await removePlate(oldPlateNumber);
    }

    return { success: true };
  } catch (error) {
    console.error("Error correcting plate read:", error);
    return { success: false, error: "Failed to correct plate read" };
  }
}

export async function addKnownPlateWithMisreads(formData) {
  try {
    const plateNumber = formData.get("plateNumber");
    const name = formData.get("name");
    const notes = formData.get("notes") || null;
    const misreads = JSON.parse(formData.get("misreads") || "[]");

    const plate = await addKnownPlateWithMisreadsDB({
      plateNumber,
      name,
      notes,
      misreads,
    });

    return { success: true, data: plate };
  } catch (error) {
    console.error("Error adding known plate with misreads:", error);
    return { success: false, error: "Failed to add known plate with misreads" };
  }
}

export async function deleteMisread(formData) {
  try {
    const plateNumber = formData.get("plateNumber");
    await removeMisread(plateNumber);
    return { success: true };
  } catch (error) {
    console.error("Error removing misread:", error);
    return { success: false, error: "Failed to remove misread" };
  }
}

export async function getAllPlatesWithKnownInfo({
  page = 1,
  pageSize = 10,
  sortField = 'first_seen_at',
  sortOrder = 'DESC',
  filters = {}
} = {}) {
  try {
    const dbFilters = {
      ...filters,
      dateFrom: filters.dateFrom || null,
      dateTo: filters.dateTo || null
    };

    const result = await db.getAllPlatesWithKnownInfo({
      page,
      pageSize,
      sortField,
      sortOrder,
      filters: dbFilters
    });

    return {
      success: true,
      data: result.data,
      pagination: result.pagination,
      appliedSort: { field: sortField, order: sortOrder },
      appliedFilters: filters
    };
  } catch (error) {
    console.error('Error in getAllPlatesWithKnownInfo action:', error);
    return { success: false, error: error.message };
  }
}

export async function deleteMisreadFromDB(formData) {
  try {
    const plateNumber = formData.get("plateNumber");
    await db.deleteMisreadFromDB(plateNumber);
    return { success: true, message: "Misread deleted successfully" };
  } catch (error) {
    console.error("Failed to delete misread:", error);
    return { success: false, message: "Failed to delete misread" };
  }
}