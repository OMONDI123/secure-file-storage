// middleware/fileAuth.ts
import { Request, Response, NextFunction } from "express";
import { pool } from "../config/db";

export const authorizeFileAccess = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const fileId = req.params.id;
    const userId = req.user?.sub;

    if (!userId) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const result = await pool.query(
      `SELECT * FROM files WHERE id = $1`,
      [fileId]
    );

    const file = result.rows[0];
    if (!file) {
      return res.status(404).json({ error: "File not found" });
    }

    // Only owner can access
    if (file.owner_id !== userId) {
      return res.status(403).json({ error: "Access denied" });
    }

    req.file = file;
    next();
  } catch (error) {
    next(error);
  }
};
