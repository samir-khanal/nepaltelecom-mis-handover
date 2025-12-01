/**
 * Safely evaluates mathematical formulas for calculated fields
 * Supports basic arithmetic: +, -, *, /, ()
 */

export function evaluateFormula(
  formula: string,
  data: Record<string, any>
): number {
  try {
    // Replace field names with their values
    let expression = formula.trim();
    
    // Sort field names by length (longest first) to avoid partial replacements
    const fieldNames = Object.keys(data).sort((a, b) => b.length - a.length);
    
    fieldNames.forEach(fieldName => {
      const value = data[fieldName];
      const numValue = parseFloat(value) || 0;
      
      // Replace all occurrences of the field name with its value
      // Use word boundaries to avoid partial matches
      const regex = new RegExp(`\\b${fieldName}\\b`, 'g');
      expression = expression.replace(regex, String(numValue));
    });

    // Security check: only allow numbers, spaces, and basic math operators
    if (!/^[\d\s+\-*/().]+$/.test(expression)) {
      throw new Error('Invalid formula: contains forbidden characters');
    }

    // Evaluate the expression
    // Note: In production, consider using a safer expression evaluator like math.js
    const result = Function('"use strict"; return (' + expression + ')')();

    if (typeof result !== 'number' || isNaN(result)) {
      throw new Error('Formula evaluation did not return a valid number');
    }

    return Math.round(result * 100) / 100; // Round to 2 decimal places
  } catch (error) {
    console.error('Formula evaluation error:', error);
    return 0;
  }
}

/**
 * Validates a formula syntax without evaluating it
 */
export function validateFormula(formula: string): { valid: boolean; error?: string } {
  try {
    // Check for basic syntax issues
    if (!formula || formula.trim() === '') {
      return { valid: false, error: 'Formula cannot be empty' };
    }

    // Check for balanced parentheses
    let parenCount = 0;
    for (const char of formula) {
      if (char === '(') parenCount++;
      if (char === ')') parenCount--;
      if (parenCount < 0) {
        return { valid: false, error: 'Unbalanced parentheses' };
      }
    }
    if (parenCount !== 0) {
      return { valid: false, error: 'Unbalanced parentheses' };
    }

    // Check for valid operators
    const validPattern = /^[a-zA-Z0-9_+\-*/().\s]+$/;
    if (!validPattern.test(formula)) {
      return { valid: false, error: 'Contains invalid characters' };
    }

    return { valid: true };
  } catch (error) {
    return { valid: false, error: 'Unknown validation error' };
  }
}