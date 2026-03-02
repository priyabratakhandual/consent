import { asyncHandler } from '../utils/asyncHandler.js';
import { masterDb } from '../db/index.js';

/**
 * GET /templates – list all consent form templates (from master DB)
 */
export const list = asyncHandler(async (req, res) => {
  const templates = await masterDb.template.findMany({
    orderBy: { createdAt: 'asc' },
    select: {
      id: true,
      title: true,
      subtitle: true,
      description: true,
      image: true,
      content: true,
      createdAt: true,
      updatedAt: true,
    },
  });
  res.json({
    success: true,
    data: { templates },
  });
});
