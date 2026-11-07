const categoryService = require('../services/categoryService');

async function listAllHandler(req, res, next) {
  try {
    const categories = await categoryService.listAll();
    return res.status(200).json({ success: true, data: categories });
  } catch (err) {
    return next(err);
  }
}

module.exports = { listAllHandler };
