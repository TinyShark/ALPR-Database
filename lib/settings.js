import fs from "fs/promises";
import path from "path";
import yaml from "js-yaml";

const CONFIG_FILE = path.join(process.cwd(), "config", "settings.yaml");

const DEFAULT_CONFIG = {
  general: {
    maxRecords: 2000,
    ignoreNonPlate: false,
  },
  mqtt: {
    broker: "",
    topic: "alpr/plates",
  },
  database: {
    host: "db:5432",
    name: "postgres",
    user: "postgres",
    password: "password",
  },
  notifications: {
    pushover: {
      enabled: false,
      app_token: "",
      user_key: "",
      priority: 1,
      sound: "pushover",
      title: "ALPR Alert",
    },
  },
  homeassistant: {
    enabled: false,
    whitelist: [],
    basePath: "",
  },
};

function getInitialEnvConfig() {
  return {
    general: {
      maxRecords: process.env.MAX_RECORDS
        ? parseInt(process.env.MAX_RECORDS)
        : DEFAULT_CONFIG.general.maxRecords,
      ignoreNonPlate: process.env.IGNORE_NON_PLATE
        ? process.env.IGNORE_NON_PLATE === "true"
        : DEFAULT_CONFIG.general.ignoreNonPlate,
    },
    mqtt: {
      broker: process.env.MQTT_BROKER || DEFAULT_CONFIG.mqtt.broker,
      topic: process.env.MQTT_TOPIC || DEFAULT_CONFIG.mqtt.topic,
    },
    database: {
      host: process.env.DB_HOST || DEFAULT_CONFIG.database.host,
      name: process.env.DB_NAME || DEFAULT_CONFIG.database.name,
      user: process.env.DB_USER || DEFAULT_CONFIG.database.user,
      password: process.env.DB_PASSWORD || DEFAULT_CONFIG.database.password,
    },
    notifications: {
      pushover: {
        enabled: process.env.PUSHOVER_ENABLED === "true",
        app_token:
          process.env.PUSHOVER_APP_TOKEN ||
          DEFAULT_CONFIG.notifications.pushover.app_token,
        user_key:
          process.env.PUSHOVER_USER_KEY ||
          DEFAULT_CONFIG.notifications.pushover.user_key,
        priority: process.env.PUSHOVER_PRIORITY
          ? parseInt(process.env.PUSHOVER_PRIORITY)
          : DEFAULT_CONFIG.notifications.pushover.priority,
        sound:
          process.env.PUSHOVER_SOUND ||
          DEFAULT_CONFIG.notifications.pushover.sound,
        title:
          process.env.PUSHOVER_TITLE ||
          DEFAULT_CONFIG.notifications.pushover.title,
      },
    },
    homeassistant: {
      enabled: process.env.HOMEASSISTANT_ENABLED === "true" || DEFAULT_CONFIG.homeassistant.enabled,
      whitelist: process.env.HOMEASSISTANT_WHITELIST 
        ? process.env.HOMEASSISTANT_WHITELIST.split(',') 
        : DEFAULT_CONFIG.homeassistant.whitelist,
      basePath: process.env.BASE_PATH || DEFAULT_CONFIG.homeassistant.basePath,
    },
  };
}

async function ensureConfigDir() {
  const configDir = path.dirname(CONFIG_FILE);
  try {
    await fs.access(configDir);
  } catch {
    await fs.mkdir(configDir, { recursive: true });
  }
}

async function readConfigFile() {
  try {
    const fileContents = await fs.readFile(CONFIG_FILE, "utf8");
    const config = yaml.load(fileContents);
    return config;
  } catch (error) {
    if (error.code === "ENOENT") {
      console.log("No config file found");
      return null;
    }
    throw error;
  }
}

async function initializeConfigFile() {
  console.log("Initializing config file with environment values");
  const initialConfig = getInitialEnvConfig();
  const yamlString = yaml.dump(initialConfig);
  await ensureConfigDir();
  await fs.writeFile(CONFIG_FILE, yamlString, "utf8");
  return initialConfig;
}

export async function getConfig() {
  try {
    let fileConfig = await readConfigFile();

    if (!fileConfig) {
      fileConfig = await initializeConfigFile();
    }

    const finalConfig = {
      general: { ...DEFAULT_CONFIG.general, ...fileConfig.general },
      mqtt: { ...DEFAULT_CONFIG.mqtt, ...fileConfig.mqtt },
      database: { ...DEFAULT_CONFIG.database, ...fileConfig.database },
      notifications: {
        pushover: {
          ...DEFAULT_CONFIG.notifications.pushover,
          ...fileConfig.notifications?.pushover,
        },
      },
      homeassistant: {
        ...DEFAULT_CONFIG.homeassistant,
        ...fileConfig.homeassistant,
      },
    };

    return finalConfig;
  } catch (error) {
    console.error("Error reading config:", error);
    return getInitialEnvConfig();
  }
}

export async function isFirstRun() {
  try {
    await fs.access(CONFIG_FILE);
    return false;
  } catch {
    return true;
  }
}

export async function saveConfig(newConfig) {
  try {
    const configToSave = {
      general: {
        ...DEFAULT_CONFIG.general,
        ...newConfig.general,
      },
      mqtt: {
        ...DEFAULT_CONFIG.mqtt,
        ...newConfig.mqtt,
      },
      database: {
        ...DEFAULT_CONFIG.database,
        ...newConfig.database,
      },
      notifications: {
        pushover: {
          ...DEFAULT_CONFIG.notifications.pushover,
          ...newConfig.notifications?.pushover,
        },
      },
      homeassistant: {
        ...DEFAULT_CONFIG.homeassistant,
        ...newConfig.homeassistant,
      },
    };
    await ensureConfigDir();
    const yamlString = yaml.dump(configToSave);
    await fs.writeFile(CONFIG_FILE, yamlString, "utf8");

    return { success: true, data: configToSave };
  } catch (error) {
    console.error("Error saving config:", error);
    return { success: false, error: "Failed to save configuration" };
  }
}

