import pg from "pg";
import { getConfig } from "@/lib/settings";
import { format, parseISO, isValid } from "date-fns";

let pool = null;
let currentConfigHash = null;

function getConfigHash(config) {
  return JSON.stringify({
    host: config?.database?.host,
    name: config?.database?.name,
    user: config?.database?.user,
    password: config?.database?.password,
  });
}

export async function resetPool() {
  if (pool) {
    await pool.end();
    pool = null;
    currentConfigHash = null;
  }
}

export async function getPool(retryCount = 3) {
  try {
    const config = await getConfig();
    const newConfigHash = getConfigHash(config);

    // If config has changed or pool doesn't exist, create new pool
    if (!pool || newConfigHash !== currentConfigHash) {
      await resetPool();

      // Parse host and port, handling edge cases
      const [host, portStr] = (
        config?.database?.host || "localhost:5432"
      ).split(":");
      const port = parseInt(portStr || "5432", 10);

      console.log(`Connecting to database at ${host}:${port}`); // Debug log

      pool = new pg.Pool({
        host: host,
        port: port,
        user: config?.database?.user || "postgres",
        password: config?.database?.password || "password",
        database: config?.database?.name || "postgres",
        max: 20,
        idleTimeoutMillis: 30000,
        connectionTimeoutMillis: 5000, // Increased timeout
      });

      // Test the connection
      try {
        const client = await pool.connect();
        await client.query("SELECT 1");
        client.release();
        console.log("Database connection successful"); // Debug log
        currentConfigHash = newConfigHash;
      } catch (error) {
        await resetPool();
        console.error("Database connection test failed:", error);

        // Retry logic
        if (retryCount > 0) {
          console.log(
            `Retrying connection... (${retryCount} attempts remaining)`
          );
          await new Promise((resolve) => setTimeout(resolve, 1000)); // Wait 1 second
          return getPool(retryCount - 1);
        }

        throw new Error(`Database connection failed: ${error.message}`);
      }
    }

    return pool;
  } catch (error) {
    console.error("Error getting database pool:", error);
    throw error;
  }
}

// Default page size for paginated queries
const DEFAULT_PAGE_SIZE = 25;

export async function getPlateReads({
  page = 1,
  pageSize = 25,
  filters = {},
} = {}) {
  const pool = await getPool();
  const offset = (page - 1) * pageSize;
  let paramIndex = 1;
  let conditions = [];
  let countValues = [];
  let queryValues = [];

  // Build filter conditions
  if (filters.plateNumber) {
    if (filters.fuzzySearch) {
      const normalizedSearch = filters.plateNumber
        .replace(/[^a-zA-Z0-9]/g, "")
        .toUpperCase();

      conditions.push(`(
        pr.plate_number ILIKE $${paramIndex} OR 
        REPLACE(REPLACE(UPPER(pr.plate_number), ' ', ''), '*', '') LIKE $${
          paramIndex + 1
        } OR
        LEVENSHTEIN(
          REPLACE(REPLACE(UPPER(pr.plate_number), ' ', ''), '*', ''),
          $${paramIndex + 2}
        ) <= GREATEST(2, CEIL(LENGTH($${paramIndex + 2}) * 0.25))
      )`);

      countValues.push(
        `%${filters.plateNumber}%`,
        `%${normalizedSearch}%`,
        normalizedSearch
      );
      queryValues.push(
        `%${filters.plateNumber}%`,
        `%${normalizedSearch}%`,
        normalizedSearch
      );
      paramIndex += 3;
    } else {
      conditions.push(`pr.plate_number ILIKE $${paramIndex}`);
      countValues.push(`%${filters.plateNumber}%`);
      queryValues.push(`%${filters.plateNumber}%`);
      paramIndex++;
    }
  }

  if (filters.tag && filters.tag !== "all") {
    conditions.push(`EXISTS (
      SELECT 1 FROM plate_tags pt2 
      JOIN tags t2 ON pt2.tag_id = t2.id 
      WHERE pt2.plate_number = pr.plate_number 
      AND t2.name = $${paramIndex}
    )`);
    countValues.push(filters.tag);
    queryValues.push(filters.tag);
    paramIndex++;
  }

  if (filters.cameraName) {
    conditions.push(`pr.camera_name ILIKE $${paramIndex}`);
    countValues.push(`%${filters.cameraName}%`);
    queryValues.push(`%${filters.cameraName}%`);
    paramIndex++;
  }

  if (filters.dateRange?.from && filters.dateRange?.to) {
    conditions.push(
      `pr.timestamp::date BETWEEN $${paramIndex} AND $${paramIndex + 1}`
    );
    countValues.push(filters.dateRange.from, filters.dateRange.to);
    queryValues.push(filters.dateRange.from, filters.dateRange.to);
    paramIndex += 2;
  }

  const whereClause =
    conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";

  // Count query (unchanged)
  const countQuery = `
    SELECT COUNT(DISTINCT pr.id)
    FROM plate_reads pr
    LEFT JOIN plate_tags pt ON pr.plate_number = pt.plate_number
    LEFT JOIN tags t ON pt.tag_id = t.id
    ${whereClause}
  `;

  const countResult = await pool.query(countQuery, countValues);
  const totalCount = parseInt(countResult.rows[0].count);
  const pageCount = Math.ceil(totalCount / pageSize); // Correct calculation

  // Main query with added known plate and misread functionality
  const dataQuery = `
    SELECT 
      pr.*,
      p.flagged,
      /* New fields for known plates and misreads */
      COALESCE(
        kp.plate_number,
        (SELECT parent_plate_number 
         FROM known_plates 
         WHERE plate_number = pr.plate_number)
      ) as known_plate,
      COALESCE(
        kp.name,
        (SELECT kp2.name 
         FROM known_plates kp2 
         WHERE kp2.plate_number = 
           (SELECT parent_plate_number 
            FROM known_plates 
            WHERE plate_number = pr.plate_number))
      ) as known_name,
      COALESCE(
        kp.notes,
        (SELECT kp2.notes 
         FROM known_plates kp2 
         WHERE kp2.plate_number = 
           (SELECT parent_plate_number 
            FROM known_plates 
            WHERE plate_number = pr.plate_number))
      ) as known_notes,
      /* End of new fields */
      array_agg(DISTINCT jsonb_build_object('name', t.name, 'color', t.color)) 
        FILTER (WHERE t.name IS NOT NULL) as tags
    FROM plate_reads pr
    LEFT JOIN plates p ON pr.plate_number = p.plate_number
    /* New join for known plates */
    LEFT JOIN known_plates kp ON pr.plate_number = kp.plate_number
    LEFT JOIN plate_tags pt ON pr.plate_number = pt.plate_number
    LEFT JOIN tags t ON pt.tag_id = t.id
    ${whereClause}
    GROUP BY 
      pr.id, 
      pr.plate_number,
      pr.timestamp,
      pr.camera_name,
      pr.image_data,
      p.flagged,
      /* New group by fields */
      kp.plate_number,
      kp.name,
      kp.notes
    ORDER BY pr.timestamp DESC
    LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
  `;

  queryValues.push(pageSize, offset);

  const result = await pool.query(dataQuery, queryValues);

  return {
    data: result.rows,
    pagination: {
      total: totalCount,
      pageCount, // Correct usage
      page,
      pageSize,
    },
  };
}

// Optimized getAllPlates with pagination support
export async function getAllPlates(paginationOpts) {
  const pool = await getPool();
  if (paginationOpts && typeof paginationOpts === "object") {
    const {
      page = 1,
      pageSize = DEFAULT_PAGE_SIZE,
      sortBy = "first_seen_at",
      sortDesc = true,
    } = paginationOpts;
    const offset = (page - 1) * pageSize;

    const result = await pool.query(`
      WITH read_counts AS (
        SELECT 
          plate_number,
          COUNT(*) as occurrence_count,
          MAX(timestamp) as last_seen_at
        FROM plate_reads
        GROUP BY plate_number
      ),
      parent_plates AS (
        SELECT 
          p.plate_number,
          p.first_seen_at,
          p.created_at,
          p.flagged,
          kp.name,
          kp.notes,
          COALESCE(rc.occurrence_count, 0) as own_occurrence_count,
          rc.last_seen_at,
          (
            SELECT COALESCE(SUM(rc_child.occurrence_count), 0)
            FROM known_plates kp_child
            LEFT JOIN read_counts rc_child ON kp_child.plate_number = rc_child.plate_number
            WHERE kp_child.parent_plate_number = p.plate_number
          ) as misread_occurrence_count
        FROM plates p
        LEFT JOIN known_plates kp ON p.plate_number = kp.plate_number
        LEFT JOIN read_counts rc ON p.plate_number = rc.plate_number
        WHERE NOT EXISTS (
          SELECT 1 FROM known_plates kp2
          WHERE kp2.plate_number = p.plate_number
          AND kp2.parent_plate_number IS NOT NULL
        )
      ),
      misread_plates AS (
        SELECT 
          p.plate_number,
          p.first_seen_at,
          p.created_at,
          p.flagged,
          kp.name,
          kp.notes,
          kp.parent_plate_number,
          COALESCE(rc.occurrence_count, 0) as occurrence_count,
          rc.last_seen_at
        FROM plates p
        JOIN known_plates kp ON p.plate_number = kp.plate_number
        LEFT JOIN read_counts rc ON p.plate_number = rc.plate_number
        WHERE kp.parent_plate_number IS NOT NULL
      )
      SELECT 
        pp.*,
        pp.own_occurrence_count + pp.misread_occurrence_count as total_occurrence_count,
        CASE 
          WHEN EXISTS (
            SELECT 1 FROM plate_tags pt2 
            WHERE pt2.plate_number = pp.plate_number
          ) THEN
            array_agg(DISTINCT jsonb_build_object('name', t.name, 'color', t.color)) 
            FILTER (WHERE t.name IS NOT NULL)
          ELSE NULL
        END as tags,
        CASE 
          WHEN pp.last_seen_at IS NOT NULL THEN 
            EXTRACT(DAY FROM NOW() - pp.last_seen_at)::integer
          ELSE 
            15
        END as days_since_last_seen,
        (
          SELECT jsonb_agg(jsonb_build_object(
            'plate_number', mp.plate_number,
            'first_seen_at', mp.first_seen_at,
            'occurrence_count', mp.occurrence_count,
            'last_seen_at', mp.last_seen_at
          ))
          FROM misread_plates mp
          WHERE mp.parent_plate_number = pp.plate_number
        ) as misreads
      FROM parent_plates pp
      LEFT JOIN plate_tags pt ON pp.plate_number = pt.plate_number
      LEFT JOIN tags t ON pt.tag_id = t.id
      GROUP BY 
        pp.plate_number,
        pp.first_seen_at,
        pp.created_at,
        pp.flagged,
        pp.name,
        pp.notes,
        pp.own_occurrence_count,
        pp.misread_occurrence_count,
        pp.last_seen_at
      ORDER BY ${
        sortBy === "days_since_last_seen"
          ? "days_since_last_seen"
          : `pp.${sortBy}`
      } ${sortDesc ? "DESC" : "ASC"}
      LIMIT $1 OFFSET $2
    `, [pageSize, offset]);

    return {
      data: result.rows,
      pagination: {
        total: parseInt(countResult.rows[0].count),
        pageCount: Math.ceil(parseInt(countResult.rows[0].count) / pageSize),
        page,
        pageSize,
      },
    };
  }

  // Original non-paginated query for backward compatibility
  const result = await pool.query(`
    WITH read_counts AS (
      SELECT 
        plate_number,
        COUNT(*) as occurrence_count,
        MAX(timestamp) as last_seen_at
      FROM plate_reads
      GROUP BY plate_number
    )
    SELECT 
      p.plate_number,
      p.first_seen_at,
      p.created_at,
      p.flagged,
      COALESCE(kp.name, parent_kp.name) as name,
      COALESCE(kp.notes, parent_kp.notes) as notes,
      COALESCE(rc.occurrence_count, 0) as occurrence_count,
      CASE 
        WHEN EXISTS (
          SELECT 1 FROM plate_tags pt2 
          WHERE pt2.plate_number = p.plate_number
        ) THEN
          array_agg(DISTINCT jsonb_build_object('name', t.name, 'color', t.color)) 
            FILTER (WHERE t.name IS NOT NULL)
        ELSE
          array_agg(DISTINCT jsonb_build_object('name', parent_t.name, 'color', parent_t.color))
            FILTER (WHERE parent_t.name IS NOT NULL)
      END as tags,
      CASE 
        WHEN rc.last_seen_at IS NOT NULL THEN 
          EXTRACT(DAY FROM NOW() - rc.last_seen_at)::integer
        ELSE 
          15
      END as days_since_last_seen
    FROM plates p
    LEFT JOIN known_plates kp ON p.plate_number = kp.plate_number
    LEFT JOIN known_plates parent_kp ON kp.parent_plate_number = parent_kp.plate_number
    LEFT JOIN read_counts rc ON p.plate_number = rc.plate_number
    LEFT JOIN plate_tags pt ON p.plate_number = pt.plate_number
    LEFT JOIN tags t ON pt.tag_id = t.id
    LEFT JOIN plate_tags parent_pt ON parent_kp.plate_number = parent_pt.plate_number
    LEFT JOIN tags parent_t ON parent_pt.tag_id = parent_t.id
    GROUP BY 
      p.plate_number,
      p.first_seen_at,
      p.created_at,
      p.flagged,
      COALESCE(kp.name, parent_kp.name),
      COALESCE(kp.notes, parent_kp.notes),
      rc.occurrence_count,
      rc.last_seen_at
    ORDER BY p.first_seen_at DESC`);

  return result.rows;
}

export async function getFlaggedPlates() {
  const pool = await getPool();
  const query = `
    SELECT 
      p.plate_number,
      array_agg(DISTINCT jsonb_build_object('name', t.name, 'color', t.color)) 
        FILTER (WHERE t.name IS NOT NULL) as tags
    FROM plates p
    LEFT JOIN plate_tags pt ON p.plate_number = pt.plate_number
    LEFT JOIN tags t ON pt.tag_id = t.id
    WHERE p.flagged = true
    GROUP BY p.plate_number
    ORDER BY p.plate_number`;

  const result = await pool.query(query);
  return result.rows;
}

export async function getNotificationPlates() {
  try {
    const pool = await getPool();
    const query = `
      SELECT 
        pn.*,
        array_agg(DISTINCT jsonb_build_object('name', t.name, 'color', t.color)) 
          FILTER (WHERE t.name IS NOT NULL) as tags
      FROM plate_notifications pn
      LEFT JOIN plate_tags pt ON pn.plate_number = pt.plate_number
      LEFT JOIN tags t ON pt.tag_id = t.id
      GROUP BY pn.id, pn.plate_number, pn.enabled, pn.priority, pn.created_at, pn.updated_at
      ORDER BY pn.created_at DESC
    `;
    const result = await pool.query(query);
    return result.rows;
  } catch (error) {
    console.error("Error fetching notification plates:", error);
    throw error;
  }
}

export async function addNotificationPlate(plateNumber) {
  const pool = await getPool();
  const query = `
    INSERT INTO plate_notifications (plate_number, priority)
    VALUES ($1, 1)
    ON CONFLICT ON CONSTRAINT plate_notifications_plate_number_key
    DO UPDATE
    SET enabled = true, updated_at = CURRENT_TIMESTAMP
    RETURNING *
  `;
  const result = await pool.query(query, [plateNumber]);
  return result.rows[0];
}

export async function updateNotificationPriorityDB(plateNumber, priority) {
  const pool = await getPool();
  const query = `
    UPDATE plate_notifications
    SET priority = $2, updated_at = CURRENT_TIMESTAMP
    WHERE plate_number = $1
    RETURNING *
  `;
  const result = await pool.query(query, [plateNumber, priority]);
  return result.rows[0];
}

export async function toggleNotification(plateNumber, enabled) {
  const pool = await getPool();
  const query = `
    UPDATE plate_notifications
    SET enabled = $2, updated_at = CURRENT_TIMESTAMP
    WHERE plate_number = $1
    RETURNING *
  `;
  const result = await pool.query(query, [plateNumber, enabled]);
  return result.rows[0];
}

export async function deleteNotification(plateNumber) {
  const pool = await getPool();
  const query = `DELETE FROM plate_notifications WHERE plate_number = $1`;
  await pool.query(query, [plateNumber]);
}

export async function checkPlateForNotification(plateNumber) {
  const pool = await getPool();
  const query = `
    SELECT * FROM plate_notifications
    WHERE plate_number = $1 AND enabled = true
  `;
  const result = await pool.query(query, [plateNumber]);
  return result.rows[0];
}

export async function getPlateDetails(plateNumber) {
  const pool = await getPool();
  const query = `
    SELECT 
      p.notes, 
      p.name,
      pn.priority,
      pn.enabled
    FROM plates p
    LEFT JOIN plate_notifications pn ON p.plate_number = pn.plate_number
    WHERE p.plate_number = $1
  `;
  const result = await pool.query(query, [plateNumber]);
  return result.rows[0];
}

export async function getMetrics(startDate, endDate) {
  const pool = await getPool();
  const query = `
    WITH daily_stats AS (
      SELECT 
        COUNT(DISTINCT plate_number) as unique_plates,
        COUNT(*) as total_reads
      FROM plate_reads 
      WHERE timestamp > $1::timestamp with time zone - INTERVAL '24 hours' AND timestamp <= $1::timestamp with time zone
    ),
    weekly_stats AS (
      SELECT COUNT(DISTINCT plate_number) as weekly_unique
      FROM plate_reads 
      WHERE timestamp > $2::timestamp with time zone AND timestamp <= $1::timestamp with time zone
    ),
    suspicious_all_time AS (
      SELECT COUNT(DISTINCT pr.plate_number) as suspicious_count
      FROM plate_reads pr
      JOIN plate_tags pt ON pr.plate_number = pt.plate_number
      JOIN tags t ON pt.tag_id = t.id
      WHERE t.name = 'Suspicious'
    ),
    time_data AS (
      SELECT 
        timestamp,
        EXTRACT(HOUR FROM timestamp)::integer as hour,
        1 as frequency
      FROM plate_reads
      WHERE timestamp > $2::timestamp with time zone AND timestamp <= $1::timestamp with time zone
    ),
    top_plates AS (
      SELECT 
        plate_number,
        COUNT(*) as occurrence_count
      FROM plate_reads
      WHERE timestamp > $1::timestamp with time zone - INTERVAL '24 hours' AND timestamp <= $1::timestamp with time zone
      GROUP BY plate_number
      ORDER BY occurrence_count DESC
      LIMIT 5
    ),
    total_plates AS (
      SELECT COUNT(DISTINCT plate_number) as total_plates_count
      FROM plates
    )
    SELECT 
      d.unique_plates,
      d.total_reads,
      w.weekly_unique,
      s.suspicious_count,
      tp.total_plates_count,
      (SELECT json_agg(json_build_object(
        'timestamp', timestamp,
        'hour', hour,
        'frequency', frequency
      )) FROM time_data) as time_data,
      (SELECT json_agg(json_build_object(
        'plate', plate_number,
        'count', occurrence_count
      )) FROM top_plates) as top_plates
    FROM daily_stats d, weekly_stats w, suspicious_all_time s, total_plates tp
  `;

  const result = await pool.query(query, [endDate, startDate]);
  return result.rows[0];
}

// New known plates management methods
export async function manageKnownPlate({
  plateNumber,
  name = null,
  notes = null,
  tags = []
}) {
  const pool = await getPool();
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    // Insert or update the plate
    const plateResult = await client.query(
      `INSERT INTO plates (plate_number, name, notes)
       VALUES ($1, $2, $3)
       ON CONFLICT (plate_number) DO UPDATE SET
         name = EXCLUDED.name,
         notes = EXCLUDED.notes,
         updated_at = CURRENT_TIMESTAMP
       RETURNING *`,
      [plateNumber, name, notes]
    );

    // Handle tags if provided
    if (tags.length > 0) {
      // Remove existing tags
      await client.query(`DELETE FROM plate_tags WHERE plate_number = $1`, [
        plateNumber,
      ]);

      // Add new tags
      const tagQuery = `
        INSERT INTO plate_tags (plate_number, tag_id)
        SELECT $1, id FROM tags WHERE name = ANY($2)
        ON CONFLICT (plate_number, tag_id) DO NOTHING
      `;
      await client.query(tagQuery, [plateNumber, tags]);
    }

    // Get the complete plate data with tags
    const finalResult = await client.query(
      `SELECT 
        p.*,
        array_agg(DISTINCT t.name) FILTER (WHERE t.name IS NOT NULL) as tags
       FROM plates p
       LEFT JOIN plate_tags pt ON p.plate_number = pt.plate_number
       LEFT JOIN tags t ON pt.tag_id = t.id
       WHERE p.plate_number = $1
       GROUP BY p.plate_number, p.name, p.notes, p.first_seen_at, p.created_at, p.updated_at`,
      [plateNumber]
    );

    await client.query("COMMIT");
    return finalResult.rows[0];
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

export async function getKnownPlates() {
  const pool = await getPool();
  console.log("getting known plates");
  const result = await pool.query(
    `SELECT 
      kp.plate_number,
      kp.name,
      kp.notes,
      kp.parent_plate_number,
      kp.created_at,
      array_agg(DISTINCT t.name) FILTER (WHERE t.name IS NOT NULL) as tags,
      (SELECT flagged FROM plates WHERE plate_number = kp.plate_number LIMIT 1) as flagged
     FROM known_plates kp
     LEFT JOIN plate_tags pt ON kp.plate_number = pt.plate_number
     LEFT JOIN tags t ON pt.tag_id = t.id
     GROUP BY kp.plate_number, kp.name, kp.notes, kp.parent_plate_number, kp.created_at
     ORDER BY kp.created_at DESC`
  );
  return { success: true, data: result.rows };
}

// Add/Update a known plate
export async function updateKnownPlate(plateNumber, { name, notes }) {
  const pool = await getPool();
  const result = await pool.query(
    `INSERT INTO known_plates (plate_number, name, notes)
     VALUES ($1, $2, $3)
     ON CONFLICT (plate_number) 
     DO UPDATE SET 
       name = EXCLUDED.name,
       notes = EXCLUDED.notes
     RETURNING *`,
    [plateNumber, name, notes]
  );
  return result.rows[0];
}

// Tag Management
export async function getAvailableTags() {
  const pool = await getPool();
  const result = await pool.query("SELECT * FROM tags ORDER BY name");
  return result.rows;
}

export async function createTag(name, color = "#808080") {
  const pool = await getPool();
  const result = await pool.query(
    `INSERT INTO tags (name, color) VALUES ($1, $2) RETURNING *`,
    [name, color]
  );
  return result.rows[0];
}

export async function updateTagColor(name, color) {
  const pool = await getPool();
  const result = await pool.query(
    `UPDATE tags SET color = $2 WHERE name = $1 RETURNING *`,
    [name, color]
  );
  return result.rows[0];
}

export async function deleteTag(name) {
  const pool = await getPool();
  await pool.query("DELETE FROM tags WHERE name = $1", [name]);
}

// Plate Tag Management
export async function addTagToPlate(plateNumber, tagName) {
  const pool = await getPool();
  await pool.query(
    `INSERT INTO plate_tags (plate_number, tag_id)
     SELECT $1, id FROM tags WHERE name = $2
     ON CONFLICT (plate_number, tag_id) DO NOTHING`,
    [plateNumber, tagName]
  );
}

export async function getTagsForPlate(plateNumber) {
  const pool = await getPool();
  const result = await pool.query(
    `SELECT t.name 
     FROM plate_tags pt 
     JOIN tags t ON pt.tag_id = t.id 
     WHERE pt.plate_number = $1`,
    [plateNumber]
  );
  return result.rows.map((row) => row.name);
}

export async function removeTagFromPlate(plateNumber, tagName) {
  const pool = await getPool();
  await pool.query(
    `DELETE FROM plate_tags 
     WHERE plate_number = $1 
     AND tag_id = (SELECT id FROM tags WHERE name = $2)`,
    [plateNumber, tagName]
  );
}

export async function getPlateHistory(plateNumber) {
  const pool = await getPool();
  const result = await pool.query(
    `
    SELECT 
      pr.*,
      kp.name as known_name,
      kp.notes,
      array_agg(DISTINCT jsonb_build_object('name', t.name, 'color', t.color)) 
        FILTER (WHERE t.name IS NOT NULL) as tags
    FROM plate_reads pr
    LEFT JOIN known_plates kp ON pr.plate_number = kp.plate_number
    LEFT JOIN plate_tags pt ON pr.plate_number = pt.plate_number
    LEFT JOIN tags t ON pt.tag_id = t.id
    WHERE pr.plate_number = $1
    GROUP BY pr.id, pr.plate_number, pr.image_data, pr.timestamp, kp.name, kp.notes
    ORDER BY pr.timestamp DESC`,
    [plateNumber]
  );
  return result.rows;
}

export async function removeKnownPlate(plateNumber) {
  const pool = await getPool();
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    // First, get all misreads associated with this plate
    const misreadsResult = await client.query(
      "SELECT plate_number FROM known_plates WHERE parent_plate_number = $1",
      [plateNumber]
    );
    const misreadPlates = misreadsResult.rows.map(row => row.plate_number);

    // Remove tags from all misreads
    if (misreadPlates.length > 0) {
      await client.query(
        "DELETE FROM plate_tags WHERE plate_number = ANY($1)",
        [misreadPlates]
      );
    }

    // Remove tags from the parent plate
    await client.query(
      "DELETE FROM plate_tags WHERE plate_number = $1",
      [plateNumber]
    );

    // Delete all misreads associated with the parent plate
    await client.query(
      "DELETE FROM known_plates WHERE parent_plate_number = $1",
      [plateNumber]
    );

    // Then, delete the parent plate from known_plates
    await client.query(
      "DELETE FROM known_plates WHERE plate_number = $1",
      [plateNumber]
    );

    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

export async function removePlate(plateNumber) {
  const pool = await getPool();
  const client = await pool.connect();

  try {
    await client.query("BEGIN");
    console.log('Removing plate:', plateNumber);

    // First, get all misreads associated with this plate
    const misreadsResult = await client.query(
      `SELECT plate_number 
       FROM known_plates 
       WHERE parent_plate_number = $1`,
      [plateNumber]
    );
    console.log('Found misreads:', misreadsResult.rows);

    // Delete plate_reads for all misreads
    if (misreadsResult.rows.length > 0) {
      const misreadPlates = misreadsResult.rows.map(row => row.plate_number);
      console.log('Deleting plate_reads for misreads:', misreadPlates);
      
      await client.query(
        `DELETE FROM plate_reads 
         WHERE plate_number = ANY($1)`,
        [misreadPlates]
      );
    }

    // Delete the parent plate's data
    console.log('Deleting plate_reads for parent:', plateNumber);
    await client.query(
      `DELETE FROM plate_reads WHERE plate_number = $1`,
      [plateNumber]
    );

    console.log('Deleting plates entry for parent:', plateNumber);
    await client.query(
      `DELETE FROM plates WHERE plate_number = $1`,
      [plateNumber]
    );

    await client.query("COMMIT");
    console.log('Successfully removed plate and its reads');
  } catch (error) {
    await client.query("ROLLBACK");
    console.error("Error removing plate:", error);
    throw error;
  } finally {
    client.release();
  }
}

export async function removePlateRead(plateNumber) {
  const pool = await getPool();
  await pool.query("DELETE FROM plate_reads WHERE plate_number = $1", [
    plateNumber,
  ]);
}

export async function togglePlateFlag(plateNumber, flagged) {
  const pool = await getPool();
  const result = await pool.query(
    `UPDATE plates 
     SET flagged = $1
     WHERE plate_number = $2
     RETURNING *`,
    [flagged, plateNumber]
  );

  return result.rows[0];
}

export async function getPlateInsights(plateNumber) {
  const pool = await getPool();
  try {
    // First, check if this is a misread plate
    const knownPlateResult = await pool.query(
      `SELECT parent_plate_number 
       FROM known_plates 
       WHERE plate_number = $1`,
      [plateNumber]
    );

    // If it's a misread, use the parent plate number instead
    const targetPlateNumber = knownPlateResult.rows[0]?.parent_plate_number || plateNumber;

    const result = await pool.query(`
      WITH summary AS (
        SELECT 
          $1 as plate_number,
          kp.name as known_name,
          kp.notes,
          MIN(pr.timestamp) as first_seen_at,
          MAX(pr.timestamp) as last_seen_at,
          COUNT(pr.id) as total_occurrences
        FROM plate_reads pr
        LEFT JOIN known_plates kp ON $1 = kp.plate_number
        WHERE pr.plate_number = $1
        GROUP BY kp.name, kp.notes
      ),
      plate_tags_agg AS (
        SELECT jsonb_agg(
          jsonb_build_object('name', t.name, 'color', t.color)
        ) as tags
        FROM plate_tags pt
        JOIN tags t ON pt.tag_id = t.id
        WHERE pt.plate_number = $1
      ),
      time_data_agg AS (
        SELECT jsonb_agg(
          jsonb_build_object(
            'timestamp', timestamp,
            'camera_name', camera_name,
            'image_data', image_data,
            'frequency', 1
          ) ORDER BY timestamp DESC
        ) as time_data
        FROM plate_reads
        WHERE plate_number = $1
      ),
      recent_reads_agg AS (
        SELECT jsonb_agg(
          jsonb_build_object(
            'timestamp', timestamp,
            'camera_name', camera_name,
            'image_data', image_data
          ) ORDER BY timestamp DESC
        ) as recent_reads
        FROM (
          SELECT *
          FROM plate_reads
          WHERE plate_number = $1
          ORDER BY timestamp DESC
          LIMIT 10
        ) recent
      )
      SELECT jsonb_build_object(
        'plate_number', s.plate_number,
        'known_name', s.known_name,
        'notes', s.notes,
        'first_seen_at', s.first_seen_at,
        'last_seen_at', s.last_seen_at,
        'total_occurrences', s.total_occurrences,
        'tags', COALESCE(pt.tags, jsonb_build_array()),
        'time_data', COALESCE(td.time_data, jsonb_build_array()),
        'recent_reads', COALESCE(rr.recent_reads, jsonb_build_array())
      ) as insights
      FROM summary s
      LEFT JOIN plate_tags_agg pt ON true
      LEFT JOIN time_data_agg td ON true
      LEFT JOIN recent_reads_agg rr ON true`,
      [targetPlateNumber]
    );

    return result.rows[0]?.insights || {
      plate_number: plateNumber,
      time_data: [],
      recent_reads: [],
      tags: [],
      total_occurrences: 0,
      first_seen_at: null,
      last_seen_at: null,
      known_name: null,
      notes: null
    };
  } catch (error) {
    console.error("Failed to get plate insights:", error);
    throw error;
  }
}

export async function cleanupOldRecords(maxRecords) {
  const pool = await getPool();

  // First check if we're over the threshold
  const {
    rows: [{ count }],
  } = await pool.query("SELECT COUNT(*) as count FROM plate_reads");

  // Only cleanup if we're 10% over the limit
  if (count > maxRecords * 1.1) {
    await pool.query(
      `
      WITH ranked_reads AS (
        SELECT id, 
               ROW_NUMBER() OVER (ORDER BY timestamp DESC) as rn
        FROM plate_reads
      )
      DELETE FROM plate_reads
      WHERE id IN (
        SELECT id FROM ranked_reads 
        WHERE rn > $1
      )
    `,
      [maxRecords]
    );
  }
}

export async function getDistinctCameraNames() {
  const pool = await getPool();
  try {
    const query = `
      SELECT DISTINCT camera_name 
      FROM plate_reads 
      WHERE camera_name IS NOT NULL 
      ORDER BY camera_name`;

    const result = await pool.query(query);
    return result.rows.map((row) => row.camera_name);
  } catch (error) {
    console.error("Error fetching camera names:", error);
    return [];
  }
}

export async function updatePlateRead(readId, newPlateNumber) {
  const pool = await getPool();
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    await client.query(
      `UPDATE plate_reads 
       SET plate_number = $1 
       WHERE id = $2`,
      [newPlateNumber, readId]
    );

    // Create new entry in plates table instead of updating the old one to prevent data loss in edge case where the misread is a real plate
    await client.query(
      `INSERT INTO plates (plate_number)
       VALUES ($1)
       ON CONFLICT (plate_number) DO NOTHING`,
      [newPlateNumber]
    );

    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

export async function updateAllPlateReads(oldPlateNumber, newPlateNumber) {
  const pool = await getPool();
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    await client.query(
      `UPDATE plate_reads 
       SET plate_number = $1 
       WHERE plate_number = $2`,
      [newPlateNumber, oldPlateNumber]
    );

    await client.query(
      `INSERT INTO plates (plate_number)
       VALUES ($1)
       ON CONFLICT (plate_number) DO NOTHING`,
      [newPlateNumber]
    );

    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

export async function addKnownPlateWithMisreads({
  plateNumber,
  name,
  notes,
  misreads = [],
  tags = []
}) {
  const pool = await getPool();
  const client = await pool.connect();

  try {
    await client.query('BEGIN');
    console.log('Adding known plate with misreads:', { plateNumber, name, notes, misreads });

    // Insert or update the main known plate
    const plateResult = await client.query(
      `INSERT INTO known_plates (plate_number, name, notes)
       VALUES ($1, $2, $3)
       ON CONFLICT (plate_number) 
       DO UPDATE SET 
         name = EXCLUDED.name,
         notes = EXCLUDED.notes
       RETURNING *`,
      [plateNumber, name, notes]
    );

    // Add misreads as entries with parent_plate_number
    if (misreads.length > 0) {
      for (const misread of misreads) {
        await client.query(
          `INSERT INTO known_plates (plate_number, parent_plate_number)
           VALUES ($1, $2)
           ON CONFLICT (plate_number) 
           DO UPDATE SET 
             parent_plate_number = EXCLUDED.parent_plate_number`,
          [misread, plateNumber]
        );
      }
    }

    // Handle tags if provided
    if (tags.length > 0) {
      // Your existing tag handling code
    }

    await client.query('COMMIT');
    return plateResult.rows[0];
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

export async function removeMisread(plateNumber) {
  const pool = await getPool();
  await pool.query("DELETE FROM known_plates WHERE plate_number = $1", [
    plateNumber,
  ]);
}

function relativeTime(date) {
  console.log('relativeTime input:', date, 'type:', typeof date);
  
  if (!date) {
    console.log('Date is null/undefined/empty, returning empty string');
    return '';
  }
  
  try {
    const now = new Date();
    // If date is already a Date object, use it directly
    const past = date instanceof Date ? date : new Date(date);
    console.log('Parsed date:', past, 'Valid:', !isNaN(past.getTime()));
    
    // Check if the date is valid
    if (isNaN(past.getTime())) {
      console.log('Invalid date detected, returning empty string');
      return '';
    }
    
    const diffInTime = now - past;
    const diffInDays = Math.floor(diffInTime / (1000 * 60 * 60 * 24));
    console.log('Time difference in days:', diffInDays);
    
    // Add more granular time differences
    if (diffInDays < 0) {
      console.log('Future date detected, returning empty string');
      return '';
    }
    if (diffInTime < 1000 * 60 * 60) { // Less than 1 hour
      const mins = Math.floor(diffInTime / (1000 * 60));
      return `${mins} minute${mins !== 1 ? 's' : ''} ago`;
    }
    if (diffInTime < 1000 * 60 * 60 * 24) { // Less than 24 hours
      const hours = Math.floor(diffInTime / (1000 * 60 * 60));
      return `${hours} hour${hours !== 1 ? 's' : ''} ago`;
    }
    if (diffInDays === 0) return 'Today';
    if (diffInDays === 1) return 'Yesterday';
    return `${diffInDays} days ago`;
  } catch (error) {
    console.error('Error processing date:', error, 'for input:', date);
    return '';
  }
}

export async function getAllPlatesWithKnownInfo({ 
  page = 1, 
  pageSize = 25,
  filters = {},
  sortField = 'first_seen_at',
  sortOrder = 'DESC'
} = {}) {
  const pool = await getPool();
  let queryParams = [];
  let paramIndex = 1;
  let whereClause = '';

  // Build WHERE clause based on filters
  if (filters.tag && filters.tag !== 'all') {
    whereClause += ` AND EXISTS (
      SELECT 1 FROM plate_tags pt 
      JOIN tags t ON pt.tag_id = t.id 
      WHERE pt.plate_number = p.plate_number 
      AND t.name = $${paramIndex}
    )`;
    queryParams.push(filters.tag);
    paramIndex++;
  }

  if (filters.search) {
    whereClause += ` AND (
      p.plate_number ILIKE $${paramIndex} 
      OR EXISTS (
        SELECT 1 FROM known_plates kp2 
        WHERE kp2.parent_plate_number = p.plate_number 
        AND kp2.plate_number ILIKE $${paramIndex}
      )
      OR kp.name ILIKE $${paramIndex}
      OR kp.notes ILIKE $${paramIndex}
    )`;
    queryParams.push(`%${filters.search}%`);
    paramIndex++;
  }

  if (filters.dateFrom || filters.dateTo) {
    whereClause += ` AND (
      ($${paramIndex}::text IS NULL OR p.first_seen_at >= ($${paramIndex}::text)::date) AND
      ($${paramIndex + 1}::text IS NULL OR p.first_seen_at <= ($${paramIndex + 1}::text)::date + interval '1 day')
    )`;
    queryParams.push(filters.dateFrom, filters.dateTo);
    paramIndex += 2;
  }

  // Map frontend sort fields to database columns
  const sortFieldMap = {
    'plate_number': 'p.plate_number',
    'occurrence_count': '(COALESCE(parent_reads.total_occurrences, 0))',
    'first_seen_at': 'COALESCE(parent_reads.first_seen_at, p.first_seen_at)',
    'last_seen_at': 'parent_reads.last_seen_at'
  };

  const dbSortField = sortFieldMap[sortField] || 'p.first_seen_at';
  const dbSortOrder = sortOrder === 'ASC' ? 'ASC' : 'DESC';
  const nullsOrder = sortOrder === 'ASC' ? 'NULLS FIRST' : 'NULLS LAST';

  try {
    // Count Query to get totalFilteredPlates
    const countQuery = `
      WITH read_counts AS (
        SELECT 
          plate_number,
          COUNT(*) as occurrence_count,
          MAX(timestamp) as last_seen_at
        FROM plate_reads
        GROUP BY plate_number
      ),
      all_parent_plates AS (
        SELECT DISTINCT p.plate_number
        FROM plates p
        LEFT JOIN known_plates kp ON p.plate_number = kp.plate_number
        WHERE kp.parent_plate_number IS NULL

        UNION

        SELECT DISTINCT parent_plate_number as plate_number
        FROM known_plates
        WHERE parent_plate_number IS NOT NULL
      ),
      parent_reads AS (
        SELECT 
          app.plate_number,
          COALESCE(
            (SELECT COUNT(*) FROM plate_reads pr WHERE pr.plate_number = app.plate_number),
            0
          ) + 
          COALESCE(
            (
              SELECT SUM(sub.read_count)
              FROM (
                SELECT COUNT(*) as read_count 
                FROM known_plates kp_child
                JOIN plate_reads pr_child ON pr_child.plate_number = kp_child.plate_number
                WHERE kp_child.parent_plate_number = app.plate_number
                GROUP BY kp_child.plate_number
              ) sub
            ),
            0
          ) as total_occurrences,
          GREATEST(
            COALESCE((SELECT MAX(timestamp) FROM plate_reads pr WHERE pr.plate_number = app.plate_number), '1970-01-01'::timestamp),
            COALESCE(
              (
                SELECT MAX(pr_child.timestamp)
                FROM known_plates kp_child
                JOIN plate_reads pr_child ON pr_child.plate_number = kp_child.plate_number
                WHERE kp_child.parent_plate_number = app.plate_number
              ),
              '1970-01-01'::timestamp
            )
          ) as last_seen_at,
          LEAST(
            COALESCE((SELECT MIN(timestamp) FROM plate_reads pr WHERE pr.plate_number = app.plate_number), NULL),
            COALESCE(
              (
                SELECT MIN(pr_child.timestamp)
                FROM known_plates kp_child
                JOIN plate_reads pr_child ON pr_child.plate_number = kp_child.plate_number
                WHERE kp_child.parent_plate_number = app.plate_number
              ),
              NULL
            )
          ) as first_seen_at
        FROM all_parent_plates app
        WHERE 
          EXISTS (SELECT 1 FROM plate_reads pr WHERE pr.plate_number = app.plate_number)
          OR EXISTS (
            SELECT 1 
            FROM known_plates kp_child
            JOIN plate_reads pr_child ON pr_child.plate_number = kp_child.plate_number
            WHERE kp_child.parent_plate_number = app.plate_number
          )
      )
      SELECT COUNT(DISTINCT parent_reads.plate_number) as total
      FROM parent_reads
      LEFT JOIN plates p ON parent_reads.plate_number = p.plate_number
      LEFT JOIN known_plates kp ON parent_reads.plate_number = kp.plate_number
      LEFT JOIN plate_tags pt ON parent_reads.plate_number = pt.plate_number
      LEFT JOIN tags t ON pt.tag_id = t.id
      WHERE 1=1 ${whereClause}
    `;

    const countResult = await pool.query(countQuery, queryParams);
    const totalFilteredPlates = parseInt(countResult.rows[0].total, 10) || 0;

    // Main Query to get paginated results
    const mainQuery = `
      WITH read_counts AS (
        SELECT 
          plate_number,
          COUNT(*) as occurrence_count,
          MAX(timestamp) as last_seen_at,
          MIN(timestamp) as first_seen_at
        FROM plate_reads
        GROUP BY plate_number
      ),
      all_parent_plates AS (
        SELECT DISTINCT p.plate_number
        FROM plates p
        LEFT JOIN known_plates kp ON p.plate_number = kp.plate_number
        WHERE kp.parent_plate_number IS NULL

        UNION

        SELECT DISTINCT parent_plate_number as plate_number
        FROM known_plates
        WHERE parent_plate_number IS NOT NULL
      ),
      parent_reads AS (
        SELECT 
          app.plate_number,
          COALESCE(
            (SELECT COUNT(*) FROM plate_reads pr WHERE pr.plate_number = app.plate_number),
            0
          ) + 
          COALESCE(
            (
              SELECT SUM(sub.read_count)
              FROM (
                SELECT COUNT(*) as read_count 
                FROM known_plates kp_child
                JOIN plate_reads pr_child ON pr_child.plate_number = kp_child.plate_number
                WHERE kp_child.parent_plate_number = app.plate_number
                GROUP BY kp_child.plate_number
              ) sub
            ),
            0
          ) as total_occurrences,
          GREATEST(
            COALESCE((SELECT MAX(timestamp) FROM plate_reads pr WHERE pr.plate_number = app.plate_number), '1970-01-01'::timestamp),
            COALESCE(
              (
                SELECT MAX(pr_child.timestamp)
                FROM known_plates kp_child
                JOIN plate_reads pr_child ON pr_child.plate_number = kp_child.plate_number
                WHERE kp_child.parent_plate_number = app.plate_number
              ),
              '1970-01-01'::timestamp
            )
          ) as last_seen_at,
          LEAST(
            COALESCE((SELECT MIN(timestamp) FROM plate_reads pr WHERE pr.plate_number = app.plate_number), NULL),
            COALESCE(
              (
                SELECT MIN(pr_child.timestamp)
                FROM known_plates kp_child
                JOIN plate_reads pr_child ON pr_child.plate_number = kp_child.plate_number
                WHERE kp_child.parent_plate_number = app.plate_number
              ),
              NULL
            )
          ) as first_seen_at
        FROM all_parent_plates app
        WHERE 
          EXISTS (SELECT 1 FROM plate_reads pr WHERE pr.plate_number = app.plate_number)
          OR EXISTS (
            SELECT 1 
            FROM known_plates kp_child
            JOIN plate_reads pr_child ON pr_child.plate_number = kp_child.plate_number
            WHERE kp_child.parent_plate_number = app.plate_number
          )
      )
      SELECT 
        COALESCE(p.plate_number, parent_reads.plate_number) as plate_number,
        COALESCE(parent_reads.first_seen_at, p.first_seen_at) as first_seen_at,
        p.created_at,
        p.flagged,
        kp.name,
        kp.notes,
        parent_reads.total_occurrences as occurrence_count,
        parent_reads.last_seen_at,
        CASE 
          WHEN parent_reads.last_seen_at IS NOT NULL THEN 
            EXTRACT(DAY FROM NOW() - parent_reads.last_seen_at::timestamp)::integer
          ELSE 
            NULL
        END as days_since_last_seen,
        CASE 
          WHEN EXISTS (
            SELECT 1 FROM plate_tags pt2 
            WHERE pt2.plate_number = COALESCE(p.plate_number, parent_reads.plate_number)
          ) THEN
            array_agg(DISTINCT jsonb_build_object('name', t.name, 'color', t.color)) 
            FILTER (WHERE t.name IS NOT NULL)
          ELSE NULL
        END as tags,
        (
          SELECT json_agg(
            json_build_object(
              'plate_number', kp2.plate_number,
              'name', kp2.name,
              'notes', kp2.notes,
              'occurrence_count', COALESCE(rc2.occurrence_count, 0),
              'first_seen_at', CASE 
                WHEN COALESCE(rc2.occurrence_count, 0) > 0 THEN 
                  (SELECT MIN(timestamp AT TIME ZONE 'UTC')::timestamptz 
                   FROM plate_reads pr2 
                   WHERE pr2.plate_number = kp2.plate_number)
                ELSE NULL
              END,
              'last_seen_at', CASE 
                WHEN COALESCE(rc2.occurrence_count, 0) > 0 THEN 
                  (
                    SELECT 
                      CASE 
                        WHEN rc2.last_seen_at IS NOT NULL THEN
                          (SELECT rc2.last_seen_at)
                        ELSE NULL
                      END
                  )
                ELSE NULL
              END
            )
          )
          FROM known_plates kp2
          LEFT JOIN read_counts rc2 ON kp2.plate_number = rc2.plate_number
          WHERE kp2.parent_plate_number = COALESCE(p.plate_number, parent_reads.plate_number)
        ) as misreads
      FROM parent_reads
      LEFT JOIN plates p ON parent_reads.plate_number = p.plate_number
      LEFT JOIN known_plates kp ON parent_reads.plate_number = kp.plate_number
      LEFT JOIN plate_tags pt ON parent_reads.plate_number = pt.plate_number
      LEFT JOIN tags t ON pt.tag_id = t.id
      WHERE 1=1 ${whereClause}
      GROUP BY 
        parent_reads.plate_number,
        p.plate_number,
        p.first_seen_at,
        p.created_at,
        p.flagged,
        kp.name,
        kp.notes,
        parent_reads.total_occurrences,
        parent_reads.last_seen_at,
        parent_reads.first_seen_at
      ORDER BY ${dbSortField} ${dbSortOrder} ${nullsOrder}
      LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
    `;

    // Add pagination parameters
    const mainQueryParams = [...queryParams, pageSize, (page - 1) * pageSize];
    const result = await pool.query(mainQuery, mainQueryParams);

    // Debug log for query results
    console.log('Query results for misreads:', result.rows.map(row => ({
      plate: row.plate_number,
      misreads: row.misreads ? row.misreads.map(m => ({
        plate: m.plate_number,
        occurrence_count: m.occurrence_count,
        last_seen_at: m.last_seen_at,
        raw_data: m
      })) : 'no misreads'
    })));

    // Process results with relative time
    const processedRows = result.rows.map(row => {
      console.log('Processing row:', {
        plate_number: row.plate_number,
        last_seen_at: row.last_seen_at,
        last_seen_type: typeof row.last_seen_at
      });
      
      const processed = {
        ...row,
        last_seen_at: row.last_seen_at ? relativeTime(row.last_seen_at) : '',
        misreads: row.misreads ? row.misreads.map(misread => {
          console.log('Processing misread:', {
            plate_number: misread.plate_number,
            first_seen_at: misread.first_seen_at,
            last_seen_at: misread.last_seen_at
          });
          
          return {
            ...misread,
            first_seen_at: misread.first_seen_at && misread.occurrence_count > 0 && isValid(new Date(misread.first_seen_at)) ? 
              format(new Date(misread.first_seen_at), 'dd/MM/yyyy') : '',
            last_seen_at: (() => {
              if (!misread.last_seen_at || !misread.occurrence_count > 0) return '';
              const formatted = relativeTime(misread.last_seen_at);
              console.log('Formatted misread time:', {
                plate: misread.plate_number,
                raw: misread.last_seen_at,
                formatted,
                count: misread.occurrence_count
              });
              return formatted === '0 minutes ago' ? 'Just now' : formatted;
            })()
          };
        }) : []
      };
      
      console.log('Processed row result:', {
        plate_number: processed.plate_number,
        last_seen_at: processed.last_seen_at
      });
      
      return processed;
    });

    return { 
      success: true, 
      data: processedRows,
      pagination: {
        total: totalFilteredPlates,
        page,
        pageSize,
        totalPages: Math.ceil(totalFilteredPlates / pageSize)
      }
    };
  } catch (error) {
    console.error('Error in getAllPlatesWithKnownInfo action:', error);
    return { 
      success: false, 
      message: 'An error occurred while fetching plates information.',
      error: error.message 
    };
  }
}

// Example usage in a React component
const LastSeen = ({ date }) => {
  return (
    <span>
      {date ? dayjs(date).fromNow() : ''}
    </span>
  );
};

export async function deleteMisreadFromDB(plateNumber) {
  try {
    const pool = await getPool();
    
    // Delete all occurrences of this plate from plate_reads where it's a misread
    // (exists in known_plates with a parent_plate_number)
    const result = await pool.query(
      `DELETE FROM plate_reads pr
       WHERE pr.plate_number = $1
       AND EXISTS (
         SELECT 1 
         FROM known_plates kp 
         WHERE kp.plate_number = pr.plate_number 
         AND kp.parent_plate_number IS NOT NULL
       )`,
      [plateNumber]
    );

    return { success: true };
  } catch (error) {
    console.error("Failed to delete misread from DB:", error);
    throw error;
  }
}
