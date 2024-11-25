import { cleanupOldRecords, getPool } from "@/lib/db";
import { checkPlateForNotification } from "@/lib/db";
import { sendPushoverNotification } from "@/lib/notifications";
import { getAuthConfig } from "@/lib/auth";
import { getConfig } from "@/lib/settings";

// Revised to use a blacklist of all other possible AI labels if using the memo. This will filter any other AI objects out, while still allowing for weird OCR reads and vanity plates.
const EXCLUDED_LABELS = [
  "person",
  "bicycle",
  "car",
  "motorcycle",
  "bus",
  "truck",
  "bird",
  "cat",
  "dog",
  "horse",
  "sheep",
  "cow",
  "bear",
  "deer",
  "rabbit",
  "raccoon",
  "fox",
  "skunk",
  "squirrel",
  "pig",
  "vehicle",
  "boat",
  "bottle",
  "chair",
  "cup",
  "table",
  "airplane",
  "train",
  "traffic light",
  "fire hydrant",
  "stop sign",
  "parking meter",
  "bench",
  "elephant",
  "zebra",
  "giraffe",
  "backpack",
  "umbrella",
  "handbag",
  "tie",
  "suitcase",
  "frisbee",
  "skis",
  "snowboard",
  "sports ball",
  "kite",
  "baseball bat",
  "baseball glove",
  "skateboard",
  "surfboard",
  "tennis racket",
  "wine glass",
  "fork",
  "knife",
  "spoon",
  "bowl",
  "banana",
  "apple",
  "sandwich",
  "orange",
  "broccoli",
  "carrot",
  "hot dog",
  "pizza",
  "donut",
  "cake",
  "couch",
  "potted plant",
  "bed",
  "dining table",
  "toilet",
  "tv",
  "laptop",
  "mouse",
  "remote",
  "keyboard",
  "cell phone",
  "microwave",
  "oven",
  "toaster",
  "sink",
  "refrigerator",
  "book",
  "clock",
  "vase",
  "scissors",
  "teddy bear",
  "hair drier",
  "toothbrush",
  "plate",
  "dayplate",
  "nightplate",
  "people",
  "motorbike",
].map((label) => label.toLowerCase());

function extractPlatesFromMemo(memo) {
  if (!memo) return [];

  // Split up all the detected objects/plates in memo
  const detections = memo.split(",").map((d) => d.trim());

  // Process each item in the memo
  const plates = detections
    .map((detection) => {
      // Split by colon to separate label from confidence
      const [label] = detection.split(":");

      if (!label) return null;

      // Convert to lowercase for comparison
      const normalizedLabel = label.trim().toLowerCase();

      // ignore other AI objects and only return plates
      if (EXCLUDED_LABELS.includes(normalizedLabel)) {
        return null;
      }

      // The older dayplate and nightplate models return the plate in brackets, so check for these and remove them if they are present.
      let plateNumber = label.trim();
      if (plateNumber.includes("[") && plateNumber.includes("]")) {
        plateNumber = plateNumber.replace(/\[|\]/g, "");
      }

      // Remove all spaces and return cleaned plate number in uppercase
      return plateNumber.replace(/\s+/g, "").toUpperCase();
    })
    .filter((plate) => plate !== null);

  return [...new Set(plates)]; // Remove duplicates
}

export async function POST(req) {
  let dbClient = null;

  // delete plate reads over the maxRecords limit
  const config = await getConfig();
  await cleanupOldRecords(config.maxRecords);

  try {
    const data = await req.json();
    console.log("Received plate read data:", data);

    // API key validation
    const apiKey = req.headers.get("x-api-key");
    if (!apiKey) {
      return Response.json({ error: "API key is required" }, { status: 401 });
    }

    const authConfig = await getAuthConfig();
    if (apiKey !== authConfig.apiKey) {
      return Response.json({ error: "Invalid API key" }, { status: 401 });
    }

    // Extract plates either from memo or plate_number, removing spaces in both cases
    const plates = data.memo
      ? extractPlatesFromMemo(data.memo)
      : data.plate_number
      ? [data.plate_number.replace(/\s+/g, "").toUpperCase()]
      : [];

    if (plates.length === 0) {
      return Response.json(
        { error: "No valid plates found in request" },
        { status: 400 }
      );
    }

    // Get database connection with retries
    const pool = await getPool();
    dbClient = await pool.connect();
    console.log("Database connection established");

    const timestamp = data.timestamp || new Date().toISOString();
    const processedPlates = [];
    const duplicatePlates = [];

    // Process each plate
    for (const plate of plates) {
      // Check notifications
      const shouldNotify = await checkPlateForNotification(plate);
      if (shouldNotify) {
        await sendPushoverNotification(plate, null, data.Image);
      }

      const result = await dbClient.query(
        `WITH new_plate AS (
          INSERT INTO plates (plate_number)
          VALUES ($1)
          ON CONFLICT (plate_number) DO NOTHING
        ),
        new_read AS (
          INSERT INTO plate_reads (plate_number, image_data, timestamp)
          SELECT $1, $2, $3
          WHERE NOT EXISTS (
            SELECT 1 FROM plate_reads 
            WHERE plate_number = $1 AND timestamp = $3
          )
          RETURNING id
        )
        SELECT id FROM new_read`,
        [plate, data.Image || null, timestamp]
      );

      if (result.rows.length > 0) {
        // Get the occurrences count using the same query structure as your lib/db.js
        const occurrencesResult = await dbClient.query(`
          SELECT 
            pr.plate_number,
            COUNT(pr.id) as occurrence_count
          FROM plate_reads pr
          WHERE pr.plate_number = $1
          GROUP BY pr.plate_number
        `, [plate]);

        console.log('Occurrences query result:', occurrencesResult.rows[0]); // Debug log 1

        // Get the plate tags using your existing schema
        const tagsResult = await dbClient.query(`
          SELECT 
            (
              SELECT json_agg(tag_info)
              FROM (
                SELECT DISTINCT t.name, t.color
                FROM plate_tags pt2
                JOIN tags t ON pt2.tag_id = t.id
                WHERE pt2.plate_number = $1
              ) tag_info
            ) as tags,
            kp.name as known_name
          FROM plate_reads pr
          LEFT JOIN known_plates kp ON pr.plate_number = kp.plate_number
          WHERE pr.plate_number = $1
          GROUP BY pr.plate_number, kp.name
        `, [plate]);

        const plateData = {
          id: result.rows[0].id,
          plate_number: plate,
          image_data: data.Image || null,
          timestamp: timestamp,
          occurrence_count: parseInt(occurrencesResult.rows[0].occurrence_count),
          tags: tagsResult.rows[0]?.tags || [],
          known_name: tagsResult.rows[0]?.known_name || null,
        };

        console.log('Plate data before emit:', plateData); // Debug log 2

        if (global.io) {
          console.log('Emitting new plate with tags and known name:', plateData);
          global.io.emit("newPlate", plateData);
        }

        processedPlates.push({
          plate,
          id: result.rows[0].id,
        });
      } else {
        duplicatePlates.push(plate);
      }
    }

    // Prepare response based on results
    const response = {
      processed: processedPlates,
      duplicates: duplicatePlates,
      message: `Processed ${processedPlates.length} plates, ${duplicatePlates.length} duplicates`,
    };

    const status = processedPlates.length > 0 ? 201 : 409;
    return Response.json(response, { status });
  } catch (error) {
    console.error("Error processing request:", error);
    return Response.json(
      {
        error: "Internal server error",
        details: error.message,
      },
      { status: 500 }
    );
  } finally {
    if (dbClient) {
      dbClient.release();
    }
  }
}
