import { z } from "zod";

export const safeContract = z.object({ id: z.string() });
