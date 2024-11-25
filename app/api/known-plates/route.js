import { getPool } from "@/lib/db";
import { getAuthConfig } from "@/lib/auth";

// Helper function to validate API key
async function validateApiKey(req) {
  const apiKey = req.headers.get("x-api-key");
  if (!apiKey) {
    return false;
  }
  const authConfig = await getAuthConfig();
  return apiKey === authConfig.apiKey;
}

export async function GET(req) {
  if (!(await validateApiKey(req))) {
    return Response.json({ error: "Invalid or missing API key" }, { status: 401 });
  }

  const searchParams = new URL(req.url).searchParams;
  const plateNumber = searchParams.get('plate');
  const fuzzy = searchParams.get('fuzzy') === 'true';
  
  if (!plateNumber) {
    return Response.json({ error: "Plate number is required" }, { status: 400 });
  }

  try {
    const pool = await getPool();
    const dbClient = await pool.connect();

    try {
      let query;
      let params;
      const normalizedPlate = plateNumber.replace(/[^a-zA-Z0-9]/g, '').toUpperCase();

      if (fuzzy) {
        // Using similar fuzzy logic as your existing implementation
        query = `
          SELECT 
            plate_number,
            similarity(
              REPLACE(REPLACE(UPPER(plate_number), ' ', ''), '*', ''),
              $1
            ) as similarity
          FROM known_plates 
          WHERE 
            plate_number % $1
            OR similarity(
              REPLACE(REPLACE(UPPER(plate_number), ' ', ''), '*', ''),
              $1
            ) > 0.4
            OR plate_number ILIKE $2
          ORDER BY similarity DESC
          LIMIT 1
        `;
        params = [normalizedPlate, `%${plateNumber}%`];

        const result = await dbClient.query(query, params);
        const match = result.rows[0];
        
        return Response.json({ 
          isKnown: !!match,
          match: match ? {
            plateNumber: match.plate_number,
            similarity: match.similarity
          } : null
        });
      } else {
        // Exact match
        query = 'SELECT EXISTS(SELECT 1 FROM known_plates WHERE plate_number = $1)';
        params = [plateNumber.toUpperCase()];
        
        const result = await dbClient.query(query, params);
        return Response.json({ isKnown: result.rows[0].exists });
      }
    } finally {
      dbClient.release();
    }
  } catch (error) {
    console.error("Error checking known plate:", error);
    return Response.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function DELETE(req) {
  if (!(await validateApiKey(req))) {
    return Response.json({ error: "Invalid or missing API key" }, { status: 401 });
  }

  const searchParams = new URL(req.url).searchParams;
  const plateNumber = searchParams.get('plate');
  
  if (!plateNumber) {
    return Response.json({ error: "Plate number is required" }, { status: 400 });
  }

  try {
    const pool = await getPool();
    const dbClient = await pool.connect();

    try {
      const result = await dbClient.query(
        'DELETE FROM known_plates WHERE plate_number = $1 RETURNING plate_number',
        [plateNumber.toUpperCase()]
      );
      
      if (result.rowCount === 0) {
        return Response.json({ error: "Plate not found" }, { status: 404 });
      }
      
      return Response.json({ success: true, plateNumber: result.rows[0].plate_number });
    } finally {
      dbClient.release();
    }
  } catch (error) {
    console.error("Error deleting known plate:", error);
    return Response.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function PUT(req) {
  if (!(await validateApiKey(req))) {
    return Response.json({ error: "Invalid or missing API key" }, { status: 401 });
  }

  try {
    const data = await req.json();
    
    if (!data.plateNumber) {
      return Response.json({ error: "Plate number is required" }, { status: 400 });
    }

    const pool = await getPool();
    const dbClient = await pool.connect();

    try {
      const result = await dbClient.query(
        'INSERT INTO known_plates (plate_number, name) VALUES ($1, $2) ON CONFLICT (plate_number) DO UPDATE SET name = $2 RETURNING plate_number, name',
        [data.plateNumber.toUpperCase(), data.name || null]
      );
      
      return Response.json({ 
        success: true, 
        plate: result.rows[0]
      });
    } finally {
      dbClient.release();
    }
  } catch (error) {
    console.error("Error adding known plate:", error);
    return Response.json({ error: "Internal server error" }, { status: 500 });
  }
}