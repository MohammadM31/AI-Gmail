import { NextFunction, Request, Response } from "express";
import { z } from "zod";
import { buildDigest } from "../services/digestService";

const schema = z
  .object({
    scope: z.enum(["daily", "contact"]),
    contactId: z.string().uuid().optional(),
  })
  .refine((value) => value.scope !== "contact" || Boolean(value.contactId), {
    message: "Choose a contact",
  });

export async function createDigest(req: Request, res: Response, next: NextFunction) {
  try {
    const input = schema.parse(req.body);
    const result = await buildDigest(
      req.auth!.organizationId,
      req.auth!.userId,
      input.scope,
      input.contactId
    );
    res.status(201).json(result);
  } catch (err) {
    next(err);
  }
}
