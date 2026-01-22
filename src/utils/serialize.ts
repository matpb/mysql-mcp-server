/**
 * Serializes MySQL query results to JSON-safe values.
 * Handles special types like BigInt, Buffer, Date that don't serialize properly.
 */
export function serializeForJson(data: unknown): unknown {
  if (data === null || data === undefined) {
    return data;
  }

  // Handle BigInt
  if (typeof data === 'bigint') {
    return data.toString();
  }

  // Handle Buffer
  if (Buffer.isBuffer(data)) {
    return data.toString('base64');
  }

  // Handle Date
  if (data instanceof Date) {
    return data.toISOString();
  }

  // Handle arrays
  if (Array.isArray(data)) {
    return data.map(serializeForJson);
  }

  // Handle objects (including MySQL RowDataPacket)
  if (typeof data === 'object') {
    const result: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(data)) {
      result[key] = serializeForJson(value);
    }
    return result;
  }

  // Return primitives as-is (string, number, boolean)
  return data;
}
