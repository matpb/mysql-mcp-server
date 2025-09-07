export class QuerySanitizer {
  // Patterns for mutation operations
  private static readonly MUTATION_PATTERNS = [
    /^\s*INSERT\s+/i,
    /^\s*UPDATE\s+/i,
    /^\s*DELETE\s+/i,
    /^\s*DROP\s+/i,
    /^\s*CREATE\s+/i,
    /^\s*ALTER\s+/i,
    /^\s*TRUNCATE\s+/i,
    /^\s*RENAME\s+/i,
    /^\s*REPLACE\s+/i,
    /^\s*LOAD\s+/i,
    /^\s*GRANT\s+/i,
    /^\s*REVOKE\s+/i,
    /^\s*FLUSH\s+/i,
    /^\s*LOCK\s+/i,
    /^\s*UNLOCK\s+/i,
    /^\s*SET\s+(?!.*@)/i, // Allow SET for session variables only
    /^\s*CALL\s+/i, // Stored procedures might mutate
    /^\s*START\s+TRANSACTION/i,
    /^\s*BEGIN/i,
    /^\s*COMMIT/i,
    /^\s*ROLLBACK/i,
    /^\s*SAVEPOINT/i,
    /^\s*RELEASE\s+SAVEPOINT/i,
  ];

  // Allowed read-only operations
  private static readonly ALLOWED_PATTERNS = [
    /^\s*SELECT\s+/i,
    /^\s*SHOW\s+/i,
    /^\s*DESCRIBE\s+/i,
    /^\s*DESC\s+/i,
    /^\s*EXPLAIN\s+/i,
    /^\s*WITH\s+/i, // CTEs that start with WITH
    /^\s*SET\s+@/i, // Session variables are OK
  ];

  // Additional dangerous keywords to check in subqueries
  private static readonly DANGEROUS_KEYWORDS = [
    'INTO OUTFILE',
    'INTO DUMPFILE',
    'FOR UPDATE',
    'LOCK IN SHARE MODE',
  ];

  public static sanitize(query: string): { 
    isValid: boolean; 
    error?: string;
    sanitizedQuery: string;
  } {
    // Remove comments and normalize whitespace
    let sanitizedQuery = this.removeComments(query);
    sanitizedQuery = sanitizedQuery.trim();

    if (!sanitizedQuery) {
      return {
        isValid: false,
        error: 'Query is empty',
        sanitizedQuery: '',
      };
    }

    // Check for mutation patterns
    for (const pattern of this.MUTATION_PATTERNS) {
      if (pattern.test(sanitizedQuery)) {
        return {
          isValid: false,
          error: `Query contains mutation operation: ${pattern.source}`,
          sanitizedQuery: '',
        };
      }
    }

    // Check if query starts with allowed patterns
    const startsWithAllowed = this.ALLOWED_PATTERNS.some(pattern => 
      pattern.test(sanitizedQuery)
    );

    if (!startsWithAllowed) {
      return {
        isValid: false,
        error: 'Query must start with SELECT, SHOW, DESCRIBE, DESC, EXPLAIN, WITH, or SET @',
        sanitizedQuery: '',
      };
    }

    // Check for dangerous keywords anywhere in the query
    const upperQuery = sanitizedQuery.toUpperCase();
    for (const keyword of this.DANGEROUS_KEYWORDS) {
      if (upperQuery.includes(keyword)) {
        return {
          isValid: false,
          error: `Query contains dangerous keyword: ${keyword}`,
          sanitizedQuery: '',
        };
      }
    }

    // Check for multiple statements (semicolon not in string literals)
    if (this.hasMultipleStatements(sanitizedQuery)) {
      return {
        isValid: false,
        error: 'Multiple statements are not allowed',
        sanitizedQuery: '',
      };
    }

    return {
      isValid: true,
      sanitizedQuery,
    };
  }

  private static removeComments(query: string): string {
    // Remove -- comments
    query = query.replace(/--[^\n]*/g, '');
    
    // Remove /* */ comments
    query = query.replace(/\/\*[\s\S]*?\*\//g, '');
    
    // Remove # comments (MySQL specific)
    query = query.replace(/#[^\n]*/g, '');
    
    return query;
  }

  private static hasMultipleStatements(query: string): boolean {
    // Simple check for semicolons outside of string literals
    // This is a basic implementation and might need refinement
    let inString = false;
    let stringChar = '';
    let escaped = false;

    for (let i = 0; i < query.length; i++) {
      const char = query[i];
      
      if (escaped) {
        escaped = false;
        continue;
      }

      if (char === '\\') {
        escaped = true;
        continue;
      }

      if (!inString && (char === '"' || char === "'")) {
        inString = true;
        stringChar = char;
      } else if (inString && char === stringChar) {
        inString = false;
      } else if (!inString && char === ';') {
        // Found semicolon outside of string literal
        // Check if there's more content after it
        const remaining = query.substring(i + 1).trim();
        if (remaining.length > 0) {
          return true;
        }
      }
    }

    return false;
  }

  public static isReadOnlyQuery(query: string): boolean {
    const result = this.sanitize(query);
    return result.isValid;
  }
}