function fail(res, field, message, status = 400) {
  const body = { error: message };
  if (field) body.field = field;
  res.status(status).json(body);
  return false;
}

function requiredText(res, body, field, label = field) {
  const value = body?.[field];
  if (typeof value !== 'string' || !value.trim()) return fail(res, field, `${label} is required`);
  body[field] = value.trim();
  return true;
}

function finiteNumber(res, body, field, { required = false, label = field } = {}) {
  const value = body?.[field];
  if (value === undefined || value === null || value === '') {
    return required ? fail(res, field, `${label} is required`) : true;
  }
  if ((typeof value !== 'number' && typeof value !== 'string') || !Number.isFinite(Number(value))) {
    return fail(res, field, `${label} must be a finite number`);
  }
  body[field] = Number(value);
  return true;
}

function nonNegativeNumber(res, body, field, { required = false, label = field } = {}) {
  if (!finiteNumber(res, body, field, { required, label })) return false;
  const value = body?.[field];
  if (value !== undefined && value !== null && value !== '' && Number(value) < 0) {
    return fail(res, field, `${label} cannot be negative`);
  }
  return true;
}

function positiveId(res, value, field, { required = false } = {}) {
  if (value === undefined || value === null || value === '') {
    return required ? fail(res, field, `${field} is required`) : true;
  }
  const id = Number(value);
  if (!Number.isSafeInteger(id) || id <= 0) return fail(res, field, `${field} must be a positive integer`);
  return true;
}

function isoDate(res, body, field, { required = false, label = field } = {}) {
  const value = body?.[field];
  if (value === undefined || value === null || value === '') {
    return required ? fail(res, field, `${label} is required`) : true;
  }
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return fail(res, field, `${label} must use YYYY-MM-DD format`);
  const [year, month, day] = value.split('-').map(Number);
  const parsed = new Date(Date.UTC(year, month - 1, day));
  if (parsed.getUTCFullYear() !== year || parsed.getUTCMonth() !== month - 1 || parsed.getUTCDate() !== day) return fail(res, field, `${label} is not a valid date`);
  return true;
}

function clockTime(res, body, field) {
  const value = body?.[field];
  if (value === undefined || value === null || value === '') return true;
  if (typeof value !== 'string' || !/^(?:[01]\d|2[0-3]):[0-5]\d(?:\:[0-5]\d)?$/.test(value)) return fail(res, field, `${field} must use HH:MM format`);
  return true;
}

module.exports = { fail, requiredText, finiteNumber, nonNegativeNumber, positiveId, isoDate, clockTime };
